from setuptools import setup
import os


__version__ = '0.0.0dev'


requires = [
    'Twisted',
    'txjsonrpc2',
]


def read_file(filename):
    try:
        with open(os.path.join(os.path.dirname(__file__), filename)) as f:
            return f.read()
    except IOError:
        return ''


setup(
    name='pelicide',
    packages=['pelicide'],
    version=__version__,
    description='An IDE for Pelican sites.',
    long_description=read_file('README.rst') + '\n' + read_file('changelog.rst'),
    author='Ingmar Steen',
    author_email='iksteen@gmail.com',
    url='https://github.com/iksteen/pelicide/',
    download_url='https://github.com/iksteen/pelicide/tarball/v%s' % __version__,
    install_requires=requires,
    include_package_data=True,
    entry_points={
        'console_scripts': [
            'pelicide = pelicide.__main__:main',
        ],
    },
    classifiers=[
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 3',
        'Topic :: Internet :: WWW/HTTP',
    ],
)
