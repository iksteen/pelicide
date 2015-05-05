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

    def get_sub_path(self, base_path, subdir):
        path = os.path.abspath(os.path.join(base_path, *subdir))

        if not (path + os.sep).startswith(base_path + os.sep):
            raise RuntimeError('File not in base path')

        return path

    def get_content_path(self, subdir):
        return self.get_sub_path(self.runner.settings['PATH'], subdir)

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
        return self.runner.command('build', paths)

    def jsonrpc_render(self, fmt, content):
        return self.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    def jsonrpc_list_content(self):
        return self.runner.command('scan')

    def jsonrpc_get_content(self, subdir, filename):
        path = os.path.join(self.get_content_path(subdir), filename)

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    def jsonrpc_set_content(self, subdir, filename, content):
        path = self.get_content_path(subdir)

        if not os.path.isdir(path):
            os.makedirs(path)

        with open(os.path.join(path, filename), 'wb') as f:
            f.write(content.encode('utf-8'))

    def jsonrpc_delete_content(self, subdir, filename):
        path = os.path.join(self.get_content_path(subdir), filename)

        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        os.remove(path)

    def jsonrpc_rename_content(self, subdir, old_name, new_name):
        path = self.get_content_path(subdir)

        if '/' in old_name or '\\' in old_name or '/' in new_name or '\\' in new_name:
            raise RuntimeError('Invalid filename')

        old_path = self.get_sub_path(path, [old_name])
        new_path = self.get_sub_path(path, [new_name])

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
