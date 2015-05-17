from __future__ import print_function
import mimetypes


# Augment mime types before importing anything else. Required because Twisted
# captures the mime type table on class declaration.
def augment_mime_types():
    CONTENT_TYPES = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.woff2': 'application/font-woff2',
        '.md': 'text/x-markdown',
        '.markdown': 'text/x-markdown',
        '.mkd': 'text/x-markdown',
        '.mdown': 'text/x-markdown',
        '.rst': 'text/x-rst',
        '.asc': 'text/x-asciidoc',
        '.adoc': 'text/x-asciidoc',
        '.asciidoc': 'text/x-asciidoc',
        '.creole': 'text/x-wiki.creole',
        '.textile': 'text/x-textile',
        '.rmd': 'text/x-rmarkdown',
    }
    mimetypes.init()
    for ext, content_type in CONTENT_TYPES.items():
        mimetypes.add_type(content_type, ext)
augment_mime_types()


import json
import os
import sys
import tempfile
import jinja2.filters
from pelican.log import init as log_init
from pelican import get_instance, logging, signals, Readers, urlwrappers, contents
from traceback import print_exc
import datetime
try:
    from pelican.readers import _DISCARD
except ImportError:
    _DISCARD = object()


striptags = jinja2.filters.FILTERS['striptags']


def scan(pelican, settings):
    context = settings.copy()
    # Share these among all the generators and content objects:
    context['filenames'] = {}  # maps source path to Content object or None
    context['localsiteurl'] = settings['SITEURL']

    generators = [
        cls(
            context=context,
            settings=settings,
            path=pelican.path,
            theme=pelican.theme,
            output_path=pelican.output_path,
        ) for cls in pelican.get_generator_classes()
    ]

    for p in generators:
        if hasattr(p, 'generate_context'):
            p.generate_context()

    return context, generators


def fix_draft(settings, readers, context, path, content):
    if isinstance(content, contents.Article) and content.status.lower() == 'draft':
        # Work around drafts being articles in context['filenames']
        return readers.read_file(
            base_path=settings['PATH'],
            path=path,
            content_class=contents.Draft,
            context=context
        )
    else:
        return content


def build(pelican, readers, settings, paths=None):
    context, generators = scan(pelican, settings)

    site_url = settings['SITEURL']
    output_path = settings['OUTPUT_PATH']

    urls = {}
    selected = settings['WRITE_SELECTED'] = []

    for subdir, filename in (paths if paths is not None else []):
        path = os.sep.join(subdir + [filename])
        content = context['filenames'].get(path)
        content = fix_draft(settings, readers, context, path, content)
        if content is None or not hasattr(content, 'url'):
            raise RuntimeError('Don\'t know how to build %s' % path)

        urls[path] = site_url + '/' + content.url
        selected.append(os.path.join(output_path, content.url.replace('/', os.sep)))

    writer = pelican.get_writer()

    for p in generators:
        if hasattr(p, 'generate_output'):
            p.generate_output(writer)

    signals.finalized.send(pelican)

    return urls


def render(readers, fmt, content):
    f = tempfile.NamedTemporaryFile(delete=False)
    try:
        f.write(content.encode('utf-8'))
        f.close()
        return readers.readers[fmt].read(f.name)
    except SystemExit:  # docutils calls sys.exit() on error
        raise RuntimeError('Syntax error')
    finally:
        os.unlink(f.name)


def encode_metadata(o):
    if isinstance(o, datetime.datetime):
        return o.strftime('%Y-%m-%d %H:%M:%S')
    elif isinstance(o, urlwrappers.URLWrapper):
        return str(o)
    else:
        try:
            v = str(o)
            print('Don\'t know how to serialize %s, using str().\n' % type(o), file=sys.stderr)
            return v
        except Exception:
            print_exc()
            print('Don\'t know how to serialize %s and str() failed, using None.' % type(o), file=sys.stderr)
            return None


def reply(cmd_id, result, args=None):
    sys.stdout.write('%s %s %s\n' % (cmd_id, '+' if result else '-', json.dumps(args, default=encode_metadata)))
    sys.stdout.flush()


def success(cmd_id, args=None):
    reply(cmd_id, True, args)


def fail(cmd_id, args=None):
    reply(cmd_id, False, args)


def run(config_file, init_settings):
    path = init_settings.pop('PATH', None)
    output_path = init_settings.pop('OUTPUT_PATH', None)
    theme = init_settings.pop('THEME', None)

    def get_attr(self, attr):
        try:
            return object.__getattribute__(self, attr)
        except AttributeError:
            return None

    args = type('args', (object,), {
        'settings': config_file,
        'path': path,
        'output': output_path,
        'theme': theme,
        'ignore_cache': True,
        'verbosity': logging.DEBUG,
        '__getattribute__': get_attr,
    })()

    pelican, settings = get_instance(args)
    settings.update(init_settings)
    readers = Readers(settings)

    logging.info('Initialised pelican engine.')

    sys.stdout.write('0 + %s\n' % json.dumps({
        key: settings.get(key)
        for key in ('SITENAME', 'PATH', 'THEME',)
    }))
    sys.stdout.flush()

    while True:
        command = sys.stdin.readline()
        if not command:
            break

        command = command.rstrip()
        cmd_id, cmd, args = command.split(' ', 2)
        args = json.loads(args)

        if cmd == 'quit':
            success(cmd_id)
            break
        elif cmd == 'setting':
            if len(args) > 1:
                settings[args[0]] = args[1]
            success(cmd_id, settings[args[0]])
        elif cmd == 'extensions':
            success(cmd_id, readers.extensions)
        elif cmd == 'scan':
            try:
                context, _ = scan(pelican, settings)
                project_contents = []
                for path, content in context['filenames'].items():
                    content = fix_draft(settings, readers, context, path, content)
                    subdir, filename = os.path.split(path)
                    url = getattr(content, 'url', None)
                    if url is not None:
                        url = settings['SITEURL'] + '/' + url
                    project_contents.append({
                        'dir': subdir.split(os.sep) if subdir else [],
                        'name': filename,
                        'type': content.__class__.__module__ + '.' + content.__class__.__name__,
                        'url': url,
                        'status': getattr(content, 'status', None),
                        'meta': getattr(content, 'metadata', {}),
                        'mimetype': mimetypes.guess_type(filename)[0],
                    })
                success(cmd_id, project_contents)
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        elif cmd == 'build':
            try:
                output = build(pelican, readers, settings, args)
                success(cmd_id, output)
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        elif cmd == 'render':
            try:
                content, metadata = render(readers, *args)
                success(cmd_id, {
                    'content': content,
                    'metadata': {key: val for key, val in metadata.items() if val is not _DISCARD}
                })
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        elif cmd == 'exec':
            try:
                os.system('%s 1>&2' % args[0])
                success(cmd_id, None)
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        else:
            fail(cmd_id, 'No such command')


if __name__ == '__main__':
    log_init(logging.DEBUG)
    os.environ['PATH'] = os.path.dirname(sys.executable) + os.pathsep + os.environ['PATH']
    os.chdir(os.path.dirname(sys.argv[1]))
    run(sys.argv[1], json.loads(sys.argv[2]))
