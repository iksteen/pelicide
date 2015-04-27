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
        content_path = self.runner.settings['PATH']
        if not content_path.endswith(os.sep):
            content_path += os.sep
        path = os.path.abspath(os.path.join(self.runner.settings['PATH'], os.sep.join(subdir + [filename])))

        if not path.startswith(content_path):
            raise RuntimeError('File not in content path')
        if not os.path.isfile(path):
            raise RuntimeError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    def jsonrpc_set_content(self, subdir, filename, content):
        content_path = self.runner.settings['PATH']
        path = os.path.abspath(os.path.join(content_path, os.sep.join(subdir)))

        if not (path + os.sep).startswith(content_path + os.sep):
            raise RuntimeError('File not in content path.')

        if not os.path.isdir(path):
            os.makedirs(path)

        with open(os.path.join(path, filename), 'wb') as f:
            f.write(content.encode('utf-8'))


class NoCacheFile(static.File):
    def _setContentHeaders(self, request, size=None):
        static.File._setContentHeaders(self, request, size)
        request.setHeader('cache-control', 'private, max-age=0, no-cache')


def start_service(root, project, path_prefix=''):
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
            'SITEURL': '%s/site' % path_prefix,
            'RELATIVE_URLS': False,
        },
    )

    root.putChild('rpc', PelicideService(runner))
    root.putChild('site', NoCacheFile(output_path))

    return runner.start().addCallback(
        lambda _: runner.command('build')
    ).addCallback(
        lambda _: None
    )
