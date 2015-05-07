from __future__ import print_function
import atexit
import os
import shutil
import sys
import tempfile
from fastjsonrpc.server import JSONRPCServer
from twisted.web import static
from pelicide.runner import Runner


class PelicideService(JSONRPCServer):
    def __init__(self, runner):
        JSONRPCServer.__init__(self)
        self.runner = runner

    def get_sub_path(self, subdir):
        origin, subdir = subdir[0], subdir[1:]

        if origin == 'content':
            base_path = self.runner.settings['PATH']
        else:
            raise RuntimeError('Unknown origin %s' % origin)

        path = os.path.abspath(os.path.join(base_path, *subdir))

        if not (path + os.sep).startswith(base_path + os.sep):
            raise RuntimeError('File not in base path')

        return path

    def jsonrpc_restart(self):
        return self.runner.restart().addCallback(lambda _: None)

    def jsonrpc_get_settings(self):
        return self.runner.settings

    def jsonrpc_get(self, key):
        return self.runner.command('setting', [key])

    def jsonrpc_set(self, key, value):
        return self.runner.command('setting', [key, value])

    def jsonrpc_list_extensions(self):
        return self.runner.command('extensions')

    def jsonrpc_build(self, paths=None):
        if paths:
            map(lambda p: p[0].pop(0), paths)
        return self.runner.command('build', paths)

    def jsonrpc_render(self, fmt, content):
        return self.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    def jsonrpc_list_files(self):
        def add_origin(content, origin):
            return [
                dict(d, dir=[origin] + d['dir'])
                for d in content
            ]
        return self.runner.command('scan').addCallback(add_origin, 'content')
    def jsonrpc_get_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    def jsonrpc_put_file(self, subdir, filename, content):
        path = self.get_sub_path(subdir + [filename])

        path_dir = os.path.dirname(path)
        if not os.path.isdir(path_dir):
            os.makedirs(os.path.dirname(path))

        with open(path, 'wb') as f:
            f.write(content.encode('utf-8'))

    def jsonrpc_delete_file(self, subdir, filename):
        path = self.get_sub_path(subdir + [filename])

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        os.remove(path)

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


class NoCacheFile(static.File):
    def _setContentHeaders(self, request, size=None):
        static.File._setContentHeaders(self, request, size)
        request.setHeader('cache-control', 'private, max-age=0, no-cache')


def start_service(root, project):
    def clean(tmp_path):
        print('Cleaning up {}'.format(tmp_path), file=sys.stderr)
        shutil.rmtree(tmp_path, True)

    temp_path = tempfile.mkdtemp()
    atexit.register(clean, temp_path)
    output_path = os.path.join(temp_path, 'output')

    runner = Runner(
        project['python'],
        project['pelicanconf'],
        {
            'OUTPUT_PATH': output_path,
            'SITEURL': 'site',
            'RELATIVE_URLS': True,
        },
    )

    root.putChild('rpc', PelicideService(runner))
    root.putChild('site', NoCacheFile(output_path))

    return runner.start().addCallback(
        lambda _: runner.command('build')
    ).addCallback(
        lambda _: None
    )
