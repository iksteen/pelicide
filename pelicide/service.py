from __future__ import print_function
import mimetypes
import os
import itertools

from fastjsonrpc.server import JSONRPCServer
import functools
from twisted.internet import defer


def check_token(f):
    @functools.wraps(f)
    def proxy(self, token, *args):
        if token != self.token:
            raise RuntimeError('Invalid RPC token')
        return f(self, *args)
    return proxy


class PelicideService(JSONRPCServer):
    def __init__(self, token, runner):
        JSONRPCServer.__init__(self)
        self.token = token
        self.runner = runner

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

    @check_token
    def jsonrpc_restart(self):
        return self.runner.restart().addCallback(lambda _: None)

    @check_token
    def jsonrpc_get_settings(self):
        return self.runner.settings

    @check_token
    def jsonrpc_get(self, key):
        return self.runner.command('setting', [key])

    @check_token
    def jsonrpc_set(self, key, value):
        return self.runner.command('setting', [key, value])

    @check_token
    def jsonrpc_list_extensions(self):
        return self.runner.command('extensions')

    @check_token
    def jsonrpc_build(self, paths=None):
        if paths:
            map(lambda p: p[0].pop(0), paths)
        return self.runner.command('build', paths)

    @check_token
    def jsonrpc_render(self, fmt, content):
        return self.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    @check_token
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
                self.runner.command('scan').addCallback(add_origin, 'content'),
                defer.succeed(list_files('theme')),
            ],
            consumeErrors=True
        ).addCallback(
            lambda r: list(itertools.chain(*r))
        )

    @check_token
    def jsonrpc_get_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    @check_token
    def jsonrpc_put_file(self, subdir, filename, content):
        path = self.get_sub_path(subdir + [filename])

        path_dir = os.path.dirname(path)
        if not os.path.isdir(path_dir):
            os.makedirs(os.path.dirname(path))

        with open(path, 'wb') as f:
            f.write(content.encode('utf-8'))

    @check_token
    def jsonrpc_delete_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        os.remove(path)

    @check_token
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
