Pelicide
========

An IDE for Pelican sites.

Installation
------------

Installing pelicide should be easy::

    $ pip install pelicide

Development
-----------

However, pelicide hasn't been released to pypi yet. To build a working
pelicide install, there are some requirements:

- **Python 2.7.** *(unfortunately, not all dependencies are python 3
  compatible)*
- **Node.js** *(required to host jspm)*
- **jspm** *(required to collect all javascript dependencies and build
  the production javascript files, install it using ``npm install jspm``)*
- **git** *(required to get the actual code and the dependencies)*

Once those dependencies are installed, you can get the pelicide source code,
install it's dependencies using jspm and pip::

    $ git clone git@github.com:iksteen/pelicide.git
    $ cd pelicide
    $ jspm install
    $ python setup.py develop

Running pelicide
----------------

Create a project file (pelicide.ini) in your pelican directory::

    [pelicide]
    pelicanconf=pelicanconf.py
    python=~/.pyenv/pelican/bin/python

Both settings are optional (in fact, you can run pelicide without a project
file). The default value for the ``pelicanconf`` setting is *pelicanconf.py*,
the default python interpreter is the interpreter used to execute pelicide.

The specified python interpreter will be used to set up the pelican
environment. This can be useful if you want to install pelicide in a different
virtual environment than the one you build your site with.

Now, start pelicide::

    pelicide pelicide.ini

Pelicide will output a lot of debug information (in fact, it is the debug
output of pelican which builds your site into a temporary directory) and
finally it will tell you to go to a website::

    Pelicide is running on port 6300. Visit http://127.0.0.1:6300/

Note that if you run pelicide without a project file, it will look for
pelicanconf.py in the current directory and it will use the python interpreter
used to run pelicide itself.
