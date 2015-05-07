from __future__ import print_function

import atexit
import os
import shutil
import sys
import tempfile

from twisted.web import static, script

from pelicide.runner import Runner
from pelicide.service import PelicideService


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


def start_project(project):
    root = NoCacheFile(os.path.join(os.path.dirname(__file__), 'ui'))
    root.indexNames = ['index.rpy', 'index.html']
    root.processors = {'.rpy': script.ResourceScript}
    return root, start_service(root, project)
