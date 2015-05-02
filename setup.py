from setuptools import setup
import os


__version__ = '0.0.0.dev0'


requires = [
    'Twisted',
    'fastjsonrpc',
]


def read_file(filename):
    try:
        with open(os.path.join(os.path.dirname(__file__), filename)) as f:
            return f.read()
    except IOError:
        return ''


setup(
    name='pelicide',
    version=__version__,
    description='An IDE for Pelican sites.',
    long_description=read_file('README.rst') + '\n' + read_file('changelog.rst'),
    url='https://github.com/iksteen/pelicide/',
    download_url='https://github.com/iksteen/pelicide/tarball/v%s' % __version__,

    author='Ingmar Steen',
    author_email='iksteen@gmail.com',
    platforms=['Platform Independent'],
    license='MIT',

    packages=['pelicide'],
    install_requires=requires,
    include_package_data=True,
    zip_safe=False,

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
        'Programming Language :: Python :: 2 :: Only',
        'Topic :: Internet :: WWW/HTTP',
    ],
)
