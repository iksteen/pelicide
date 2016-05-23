import asyncio
import aiohttp.web
import json
import mimetypes
import os
import itertools
import functools


def require_authentication(f):
    @functools.wraps(f)
    def proxy(self, *args):
        if not self.authenticated:
            raise RuntimeError('Session not authenticated.')
        return f(self, *args)
    return proxy


class PelicideService(object):
    def __init__(self, project, runner, token):
        self.project = project
        self.runner = runner
        self.token = token
        self.authenticated = False

    def get_sub_path(self, subdir):
        origin, subdir = subdir[0], subdir[1:]

        if origin == 'content':
            base_path = self.runner.settings['PATH']
        elif origin == 'theme':
            base_path = self.runner.settings['THEME']
        else:
            raise RuntimeError('Unknown origin %s' % origin)

        path = os.path.abspath(os.path.join(base_path, *subdir))

        if not (path + os.sep).startswith(base_path + os.sep):
            raise RuntimeError('File not in base path')

        return path

    def jsonrpc_authenticate(self, token):
        if token == self.token:
            self.authenticated = True
        else:
            self.authenticated = False
            raise RuntimeError('Authentication failed.')
        return self.authenticated

    @asyncio.coroutine
    @require_authentication
    def jsonrpc_restart(self):
        yield from self.runner.restart()

    @require_authentication
    def jsonrpc_get_settings(self):
        return self.runner.settings

    @require_authentication
    def jsonrpc_get(self, key):
        return self.runner.command('setting', [key])

    @require_authentication
    def jsonrpc_set(self, key, value):
        return self.runner.command('setting', [key, value])

    @require_authentication
    def jsonrpc_list_extensions(self):
        return self.runner.command('extensions')

    @require_authentication
    def jsonrpc_build(self, paths=None):
        if paths:
            for p in paths:
                p[0].pop(0)
        return self.runner.command('build', paths)

    @require_authentication
    @asyncio.coroutine
    def jsonrpc_render(self, fmt, content):
        v = yield from self.runner.command('render', [fmt, content])
        return v['content']

    @require_authentication
    @asyncio.coroutine
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

        return add_origin((yield from self.runner.command('scan')), 'content') + list_files('theme')

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
        return bool(self.project['deploy'])

    @require_authentication
    def jsonrpc_deploy(self):
        if self.project['deploy']:
            return self.runner.command('exec', [self.project['deploy']])


@asyncio.coroutine
def websocket_handler(project, runner, token, request):
    service = PelicideService(project, runner, token)

    ws = aiohttp.web.WebSocketResponse()
    ws.start(request)

    while True:
        msg = yield from ws.receive()

        if msg.tp == aiohttp.MsgType.text:
            message = json.loads(msg.data)
            method = getattr(service, 'jsonrpc_%s' % message['method'])
            msg_id = message['id']
            try:
                result = method(*message.get('params', []))
                if asyncio.iscoroutine(result):
                    result = yield from result
                result = {
                    'jsonrpc': '2.0',
                    'result': result,
                    'id': msg_id
                }
            except Exception as e:
                result = {
                    'jsonrpc': '2.0',
                    'error': {
                        'code': -32000,
                        'message': str(e),
                    },
                    'id': msg_id,
                }
            ws.send_str(json.dumps(result))
        elif msg.tp == aiohttp.MsgType.close:
            print('websocket connection closed')
            break
        elif msg.tp == aiohttp.MsgType.error:
            print('ws connection closed with exception %s',
                  ws.exception())
            break

    return ws