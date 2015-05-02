from invoke import task, run
from invoke.tasks import call
import os


@task()
def clean(deps=False, pybuild=False):
    """
    Clean up all files produced by a build. Optionally removes
    jspm dependencies and python build environment.
    """

    ui = os.path.join('pelicide', 'ui')

    patterns = [
        os.path.join(ui, fn)
        for fn in ['build.js', 'build.js.map', 'build.css', 'build.css.map']
    ]

    if deps:
        patterns.append(os.path.join(ui, 'jspm_packages'))

    if pybuild:
        patterns.append('build')

    for pattern in patterns:
        run("rm -rf %s" % pattern)


@task()
def deps():
    """
    Install jspm dependencies required for development.
    """

    run('jspm install')


@task(deps)
def bundle(minify=True, sourcemaps=True):
    """
    Create a bundled version of the code and its dependencies, ready for
    deployment.

    --[no-]minify: Minify the output (defaults to true).
    --[no-]sourcemaps: Build source maps (defaults to true).
    """

    args = []

    if minify:
        args.append('--minify')

    if not sourcemaps:
        args.append('--skip-source-maps')

    run('jspm bundle-sfx src/main %s' % ' '.join(args))


@task(call(bundle, sourcemaps=False))
def build():
    """
    Perform a production build of the javascript code and its dependencies.
    """


@task(pre=[call(clean, deps=True), build])
def rebuild():
    """
    Perform a full rebuild of the javascript code and its dependencies.
    """


@task(rebuild)
def wheel():
    """
    Perform a full rebuild and bundle pelicide as a python wheel.
    """

    run('python setup.py bdist_wheel')


@task(pre=[call(clean, pybuild=True), wheel])
def dist():
    """
    Build all distribution variants.
    """
