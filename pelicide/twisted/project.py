from __future__ import print_function

import atexit
import os
import shutil
import sys
import tempfile

from autobahn.twisted.resource import WebSocketResource
from autobahn.twisted.websocket import WebSocketServerFactory
from twisted.web import resource, static, script
from zope.interface import implements

from pelicide.twisted.runner import Runner
from pelicide.twisted.service import PelicideService


class NoCacheFile(static.File):
    def _setContentHeaders(self, request, size=None):
        static.File._setContentHeaders(self, request, size)
        request.setHeader('cache-control', 'private, max-age=0, no-cache')


class SetTokenWrapper(object):
    implements(resource.IResource)
    isLeaf = False

    def __init__(self, token, wrapped):
        self._token = token
        self._wrapped = wrapped

    def _set_token(self, request):
        if request.getCookie('pelicide-token') != self._token:
            request.addCookie('pelicide-token', '%s' % self._token)
        return self._wrapped

    def render(self, request):
        return self._set_token(request).render(request)

    def getChildWithDefault(self, path, request):
        request.postpath.insert(0, request.prepath.pop())
        return self._set_token(request)


def start_service(token, root, project):
    def clean(tmp_path):
        print('Cleaning up {}'.format(tmp_path), file=sys.stderr)
        shutil.rmtree(tmp_path, True)

    temp_path = project['tempdir']
    if temp_path is None:
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

    factory = WebSocketServerFactory()
    factory.token = token
    factory.runner = runner
    factory.project = project
    factory.protocol = PelicideService
    root.putChild('ws', WebSocketResource(factory))
    root.putChild('site', NoCacheFile(output_path))

    return runner.start().addCallback(
        lambda _: runner.command('build')
    ).addCallback(
        lambda _: None
    )


def start_project(token, project):
    root = NoCacheFile(os.path.join(os.path.dirname(__file__), '..', 'ui'))
    root.indexNames = ['index.rpy', 'index.html']
    root.processors = {'.rpy': script.ResourceScript}
    return root, start_service(token, root, project)
