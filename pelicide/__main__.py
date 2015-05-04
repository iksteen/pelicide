from __future__ import print_function


# Augment mime types before importing anything else. Required because Twisted
# captures the mime type table on class declaration.
def augment_mime_types():
    import mimetypes
    CONTENT_TYPES = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.woff2': 'application/font-woff2',
    }
    mimetypes.init()
    for ext, content_type in CONTENT_TYPES.items():
        mimetypes.add_type(content_type, ext)
augment_mime_types()


import ConfigParser
import argparse
import sys
import os
from twisted.internet import reactor, defer, error
from twisted.web import server, static, script
from pelicide.service import start_service


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

    config.read(os.path.expanduser('~/.config/pelicide/pelicide.ini'))

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


def start_instance(project):
    root = static.File(os.path.join(os.path.dirname(__file__), 'ui'))
    root.indexNames = ['index.rpy', 'index.html']
    root.processors = {'.rpy': script.ResourceScript}
    return root, start_service(root, project)


@defer.inlineCallbacks
def run(project, port=0):
    root, d = start_instance(project)
    yield d
    try:
        port = reactor.listenTCP(port, server.Site(root), interface='127.0.0.1')
        print('Pelicide is running. Please visit http://127.0.0.1:{}/'.format(port.getHost().port), file=sys.stderr)
    except error.CannotListenError as e:
        print(e, file=sys.stderr)
        reactor.stop()


def main():
    parser = argparse.ArgumentParser(description='An IDE for Pelican.')
    parser.add_argument('project', default=None, nargs='?', help='The pelicide project file to use.')
    parser.add_argument('--port', '-p', type=int, default=6300, help='The port to host the IDE on.')
    args = parser.parse_args()

    if args.project and not os.path.isfile(args.project):
        print('Could not load project file \'%s\'.', file=sys.stderr)
        sys.exit(1)

    project = parse_project(args.project)
    reactor.callWhenRunning(run, project, args.port)
    reactor.run()


if __name__ == '__main__':
    main()
