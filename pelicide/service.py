from __future__ import print_function
import atexit
import os
import shutil
import sys
import tempfile
from twisted.internet import defer
from twisted.web import static
from txjsonrpc2.web import server as webserver
from pelicide.runner import Runner


class PelicideService(object):
    def __init__(self, runner):
        self.runner = runner

    @defer.inlineCallbacks
    def json_rpc_restart(self):
        yield self.runner.restart()

    def json_rpc_get_settings(self):
        return self.runner.settings

    def json_rpc_set(self, key, value):
        return self.runner.command('setting', [key, value])

    def json_rpc_list_extensions(self):
        return self.runner.command('extensions')

    def json_rpc_build(self, paths=None):
        return self.runner.command('build', paths)

    def json_rpc_render(self, fmt, content):
        return self.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    def json_rpc_list_content(self):
        def process(project_content):
            content = ({}, [])
            for node in project_content:
                p = reduce(lambda a, b: a[0].setdefault(b, ({}, [])), node['dir'], content)
                p[1].append(node)

            return content

        return self.runner.command('scan').addCallback(process)

    def json_rpc_get_content(self, subdir, filename):
        content_path = self.runner.settings['PATH']
        if not content_path.endswith(os.sep):
            content_path += os.sep
        path = os.path.abspath(os.path.join(self.runner.settings['PATH'], os.sep.join(subdir + [filename])))

        if not path.startswith(content_path):
            raise IOError('File not in content path')
        if not os.path.isfile(path):
            raise IOError('File not found')

        with open(path, 'rb') as f:
            return f.read().decode('utf-8')

    def json_rpc_set_content(self, subdir, filename, content):
        content_path = self.runner.settings['PATH']
        if not content_path.endswith(os.sep):
            content_path += os.sep
        path = os.path.abspath(os.path.join(self.runner.settings['PATH'], os.sep.join(subdir + [filename])))

        if not path.startswith(content_path):
            raise IOError('File not in content path.')

        with open(path, 'wb') as f:
            f.write(content.encode('utf-8'))


@defer.inlineCallbacks
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

    root.putChild('rpc', webserver.JsonRpcResource(PelicideService(runner)))
    root.putChild('site', static.File(output_path))

    yield runner.start()
    yield runner.command('build')
