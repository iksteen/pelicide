import json
import mimetypes
import os
import itertools
import functools

from twisted.internet import defer
from autobahn.twisted.websocket import WebSocketServerProtocol


def require_authentication(f):
    @functools.wraps(f)
    def proxy(self, *args):
        if not self.authenticated:
            raise RuntimeError('Session not authenticated.')
        return f(self, *args)
    return proxy


class PelicideService(WebSocketServerProtocol):
    authenticated = False

    def onMessage(self, payload, isBinary):
        def success(result, msg_id):
            self.sendMessage(json.dumps({
                'jsonrpc': '2.0',
                'result': result,
                'id': msg_id,
            }), isBinary)

        def error_handler(f, msg_id):
            self.sendMessage(json.dumps({
                'jsonrpc': '2.0',
                'error': {
                    'code': -32000,
                    'message': f.getErrorMessage(),
                },
                'id': msg_id,
            }), isBinary)

        message = json.loads(payload)

        method = getattr(self, 'jsonrpc_%s' % message['method'])
        d = defer.maybeDeferred(method, *message.get('params', []))

        msg_id = message['id']
        if msg_id is not None:
            d.addCallbacks(
                success,
                error_handler,
                callbackArgs=[msg_id],
                errbackArgs=[msg_id],
            )

        return d

    def get_sub_path(self, subdir):
        origin, subdir = subdir[0], subdir[1:]

        if origin == 'content':
            base_path = self.factory.runner.settings['PATH']
        elif origin == 'theme':
            base_path = self.factory.runner.settings['THEME']
        else:
            raise RuntimeError('Unknown origin %s' % origin)

        path = os.path.abspath(os.path.join(base_path, *subdir))

        if not (path + os.sep).startswith(base_path + os.sep):
            raise RuntimeError('File not in base path')

        return path

    def jsonrpc_authenticate(self, token):
        if token == self.factory.token:
            self.authenticated = True
        else:
            self.authenticated = False
            raise RuntimeError('Authentication failed.')
        return self.authenticated

    @require_authentication
    def jsonrpc_restart(self):
        return self.factory.runner.restart().addCallback(lambda _: None)

    @require_authentication
    def jsonrpc_get_settings(self):
        return self.factory.runner.settings

    @require_authentication
    def jsonrpc_get(self, key):
        return self.factory.runner.command('setting', [key])

    @require_authentication
    def jsonrpc_set(self, key, value):
        return self.factory.runner.command('setting', [key, value])

    @require_authentication
    def jsonrpc_list_extensions(self):
        return self.factory.runner.command('extensions')

    @require_authentication
    def jsonrpc_build(self, paths=None):
        if paths:
            map(lambda p: p[0].pop(0), paths)
        return self.factory.runner.command('build', paths)

    @require_authentication
    def jsonrpc_render(self, fmt, content):
        return self.factory.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    @require_authentication
    def jsonrpc_list_files(self):
        def add_origin(content, origin):
            return [
                dict(d, dir=[origin] + d['dir'])
                for d in content
            ]

        def list_files(origin):
            origin_path = self.get_sub_path([origin])
            return [
                {
                    'dir': [origin] + os.path.relpath(dirpath, origin_path).split(os.sep),
                    'name': filename,
                    'mimetype': mimetypes.guess_type(filename)[0] or 'application/octet-stream',
                }
                for (dirpath, dirnames, filenames) in os.walk(origin_path)
                for filename in filenames
            ]

        return defer.gatherResults(
            [
                self.factory.runner.command('scan').addCallback(add_origin, 'content'),
                defer.succeed(list_files('theme')),
            ],
            consumeErrors=True
        ).addCallback(
            lambda r: list(itertools.chain(*r))
        )

    @require_authentication
    def jsonrpc_get_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    @require_authentication
    def jsonrpc_put_file(self, subdir, filename, content):
        path = self.get_sub_path(subdir + [filename])

        path_dir = os.path.dirname(path)
        if not os.path.isdir(path_dir):
            os.makedirs(os.path.dirname(path))

        with open(path, 'wb') as f:
            f.write(content.encode('utf-8'))

    @require_authentication
    def jsonrpc_delete_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        os.remove(path)

    @require_authentication
    def jsonrpc_rename_file(self, subdir, old_name, new_name):
        old_path = self.get_sub_path(subdir + [old_name])
        new_path = self.get_sub_path(subdir + [new_name])
        if not os.path.dirname(old_path) == os.path.dirname(new_path):
            raise RuntimeError('Invalid filename')

        if not os.path.isfile(old_path):
            raise RuntimeError('File not found')

        if os.path.exists(new_path):
            raise RuntimeError('File already exists')

        os.rename(old_path, new_path)

    @require_authentication
    def jsonrpc_can_deploy(self):
        return bool(self.factory.project['deploy'])

    @require_authentication
    def jsonrpc_deploy(self):
        if self.factory.project['deploy']:
            return self.factory.runner.command('exec', [self.factory.project['deploy']])
