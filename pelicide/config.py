import ConfigParser
import os
import sys


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
    config.set('pelicide', 'deploy', '')
    config.set('pelicide', 'tempdir', '')

    config.read(os.path.expanduser('~/.config/pelicide/pelicide.ini'))

    if project_path:
        config.read(project_path)

    def build_path(path, home):
        path = os.path.expanduser(path)
        if not os.path.isabs(path):
            path = os.path.join(home, path)
        return path

    tempdir = config.get('pelicide', 'tempdir')

    return {
        'python': build_path(config.get('pelicide', 'python'), project_home),
        'pelicanconf': build_path(config.get('pelicide', 'pelicanconf'), project_home),
        'deploy': config.get('pelicide', 'deploy'),
        'tempdir': build_path(tempdir, project_home) if tempdir else None,
    }