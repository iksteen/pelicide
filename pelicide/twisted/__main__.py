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

import argparse
import os
import random
import string
import sys
from twisted.internet import reactor, defer, error
from twisted.web import server

from pelicide.twisted.project import start_project, SetTokenWrapper
from pelicide.config import parse_project


@defer.inlineCallbacks
def run(project, port=0):
    token = ''.join(random.choice(string.ascii_letters + string.digits) for i in range(64))
    root, d = start_project(token, project)
    yield d
    try:
        port = reactor.listenTCP(port, server.Site(SetTokenWrapper(token, root)), interface='127.0.0.1')
        print('Pelicide is running. Please visit http://127.0.0.1:{}/'.format(port.getHost().port), file=sys.stderr)
    except error.CannotListenError as e:
        print(e, file=sys.stderr)
        reactor.stop()


def main():
    random.seed()

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
