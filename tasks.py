from invoke import task, run
from invoke.tasks import call
import os
import shutil


@task()
def clean(deps=False, pybuild=False):
    """
    Clean up all files produced by a build. Optionally removes
    jspm dependencies and python build environment.
    """

    ui = os.path.join('pelicide', 'ui')

    paths = [
        os.path.join(ui, fn)
        for fn in ['build.js', 'build.js.map', 'build.css', 'build.css.map']
    ]

    if deps:
        paths.append(os.path.join(ui, 'jspm_packages'))

    if pybuild:
        paths.append('build')

    for pattern in paths:
        if os.path.isfile(pattern):
            os.remove(pattern)
        elif os.path.isdir(pattern):
            shutil.rmtree(pattern)
        elif os.path.exists(pattern):
            raise RuntimeError('Don\'t know how to clean %s' % pattern)


@task()
def deps():
    """
    Install jspm dependencies required for development.
    """

    run('jspm install')


@task(deps)
def build_bundle(minify=True, sourcemaps=True):
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

    run('jspm bundle-sfx %s %s' % (os.path.join('src', 'main'), ' '.join(args)))


@task(call(build_bundle, sourcemaps=False))
def build_python():
    """
    Build everything needed to install python package.
    """

    run('python setup.py build')


@task(build_python)
def build():
    """
    Perform a production build of the javascript code, its dependencies and
    the python package.
    """


@task(pre=[call(clean, deps=True, pybuild=True), build])
def rebuild():
    """
    Perform a full rebuild of the javascript code, its dependencies and
    the python package.
    """


@task(rebuild)
def wheel():
    """
    Perform a full rebuild and bundle pelicide as a python wheel.
    """

    run('python setup.py bdist_wheel')


@task(wheel)
def dist():
    """
    Build all distribution variants.
    """


@task(build)
def nuitka():
    """
    Build a standalone nuitka distribution. Experimental.
    """

    run('nuitka --standalone %s --output-dir=build' % (
        os.path.join('build', 'lib', 'pelicide', '__main__.py'),
    ))
    os.makedirs(os.path.join('build', '__main__.dist', 'pelicide'))
    shutil.copy(
        os.path.join('build', 'lib', 'pelicide', 'pelican-runner.py'),
        os.path.join('build', '__main__.dist', 'pelicide')
    )
    shutil.copytree(
        os.path.join('build', 'lib', 'pelicide', 'ui'),
        os.path.join('build', '__main__.dist', 'ui')
    )
