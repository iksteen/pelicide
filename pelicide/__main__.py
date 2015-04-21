from __future__ import print_function
import ConfigParser
import argparse
import atexit
import shutil
import sys
import os
import tempfile
from twisted.internet import reactor, defer, error
from twisted.web import server, static
from txjsonrpc2.web import server as webserver
from pelicide.runner import Runner
from pelicide.service import PelicideService


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


def parse_project(project_path):
    if project_path:
        project_path = os.path.abspath(os.path.expanduser(project_path))
        project_home = os.path.dirname(project_path)
    else:
        project_home = os.curdir

    config = ConfigParser.SafeConfigParser({
        'here': project_home,
    })
    config.add_section('pelicide')
    config.set('pelicide', 'python', sys.executable)
    config.set('pelicide', 'pelicanconf', 'pelicanconf.py')

    if project_path:
        config.read(project_path)

    def build_path(path, home):
        path = os.path.expanduser(path)
        if not os.path.isabs(path):
            path = os.path.join(home, path)
        return path

    return {
        'python': build_path(config.get('pelicide', 'python'), project_home),
        'pelicanconf': build_path(config.get('pelicide', 'pelicanconf'), project_home),
    }


@defer.inlineCallbacks
def run_web(args, project):
    root = static.File(os.path.join(os.path.dirname(__file__), 'ui'))
    start_service(root, project, 'http://localhost:{}'.format(args.port))
    try:
        yield reactor.listenTCP(args.port, server.Site(root), interface='127.0.0.1')
        print('Pelicide is running on port {port}. Visit http://127.0.0.1:{port}/'.format(port=args.port),
              file=sys.stderr)
    except error.CannotListenError as e:
        print(e, file=sys.stderr)
        reactor.stop()


@defer.inlineCallbacks
def main():
    parser = argparse.ArgumentParser(description='An IDE for Pelican.')
    parser.add_argument('project', default=None, nargs='?', help='The pelicide project file to use.')
    parser.add_argument('--port', '-p', type=int, default=6300, help='The port to host the IDE on.')
    args = parser.parse_args()

    if args.project and not os.path.isfile(args.project):
        print('Could not load project file \'%s\'.', file=sys.stderr)
        sys.exit(1)

    project = parse_project(args.project)
    reactor.callWhenRunning(run_web, args, project)
    reactor.run()


if __name__ == '__main__':
    main()
