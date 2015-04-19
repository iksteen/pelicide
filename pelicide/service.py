import os
from twisted.internet import defer


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

    def json_rpc_build(self, filenames=None):
        return self.runner.command('build', filenames)

    def json_rpc_render(self, fmt, content):
        return self.runner.command('render', [fmt, content]).addCallback(lambda v: v['content'])

    def json_rpc_list_content(self):
        home = self.runner.settings['PATH']
        content = {}

        for path, dirnames, filenames in os.walk(home):
            if path == home:
                p = content
            else:
                rel_path = os.path.relpath(path, home)
                p = reduce(lambda a, b: a[b], rel_path.split(os.sep), content)

            for dirname in dirnames:
                if not dirname.startswith('.'):
                    p[dirname] = {}

            for filename in filenames:
                if not filename.startswith('.'):
                    p[filename] = os.path.relpath(os.path.join(path, filename), home)

        return content

    def json_rpc_get_content(self, path):
        content_path = self.runner.settings['PATH']
        if not content_path.endswith(os.sep):
            content_path += os.sep
        path = os.path.abspath(os.path.join(self.runner.settings['PATH'], path))

        if not path.startswith(content_path):
            raise IOError('File not in content path')
        if not os.path.isfile(path):
            raise IOError('File not found')

        with open(path, 'rb') as f:
            return f.read()
