from __future__ import print_function


# Augment mime types before importing anything else. Required because Twisted
# captures the mime type table on class declaration.
import asyncio
import string
import tempfile
from aiohttp import web
import atexit
import shutil
from pelicide.asyncio.runner import Runner
from pelicide.asyncio.service import websocket_handler


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
import sys

from pelicide.config import parse_project


def redirect_factory(redirect_path):
    @asyncio.coroutine
    def redirect_handler(request):
        return web.HTTPFound(redirect_path)
    return redirect_handler


def get_output_path(project):
    def clean(tmp_path):
        print('Cleaning up {}'.format(tmp_path), file=sys.stderr)
        shutil.rmtree(tmp_path, True)

    temp_path = project['tempdir']
    if temp_path is None:
        temp_path = tempfile.mkdtemp()
        atexit.register(clean, temp_path)

    return os.path.join(temp_path, 'output')


@asyncio.coroutine
def start_runner(project, output_path):
    runner = Runner(
        project['python'],
        project['pelicanconf'],
        {
            'OUTPUT_PATH': output_path,
            'SITEURL': 'site',
            'RELATIVE_URLS': True,
        },
    )
    yield from runner.start()
    yield from runner.command('build')
    return runner


def cookie_setter_factory(token):
    def handler(request):
        r = web.Response(body=b'')
        if request.cookies.get('pelicide-token') != token:
            r.set_cookie('pelicide-token', token)
        return r
    return handler


def no_cache_response_factory():
    return web.StreamResponse(headers={
        'cache-control': 'private, max-age=0, no-cache',
    })


@asyncio.coroutine
def start_service(loop, project, runner, output_path, port=0):
    token = ''.join(random.choice(string.ascii_letters + string.digits) for i in range(64))

    app = web.Application(loop=loop)
    app.router.add_route('GET', '/ws-cookie', cookie_setter_factory(token))
    app.router.add_route('GET', '/ws', lambda r: websocket_handler(project, runner, token, r))
    app.router.add_static('/site', output_path, response_factory=no_cache_response_factory)

    ui_path = os.path.join(os.path.dirname(__file__), '..', 'ui')
    if not os.path.exists(os.path.join(ui_path, 'build.js')):
        app.router.add_route('GET', '/', redirect_factory('/index-dev.html'))
    else:
        app.router.add_route('GET', '/', redirect_factory('/index.html'))
    app.router.add_static('/', ui_path, response_factory=no_cache_response_factory)

    srv = yield from loop.create_server(app.make_handler(), '127.0.0.1', port)

    print('Pelicide is running. Please visit http://127.0.0.1:{}/'.format(srv.sockets[0].getsockname()[1]),
          file=sys.stderr)
    return srv


def main():
    random.seed()

    parser = argparse.ArgumentParser(description='An IDE for Pelican.')
    parser.add_argument('project', default=None, nargs='?', help='The pelicide project file to use.')
    parser.add_argument('--port', '-p', type=int, default=6300, help='The port to host the IDE on.')
    args = parser.parse_args()

    if args.project and not os.path.isfile(args.project):
        print('Could not load project file \'%s\'.' % args.project, file=sys.stderr)
        sys.exit(1)

    project = parse_project(args.project)
    output_path = get_output_path(project)

    loop = asyncio.get_event_loop()
    runner = loop.run_until_complete(start_runner(project, output_path))
    loop.run_until_complete(start_service(loop, project, runner, output_path, args.port))
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
