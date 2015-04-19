import json
import os
import sys
import tempfile
from pelican.log import init as log_init
from pelican import get_instance, logging, signals, Readers
from traceback import print_exc


def build(pelican, settings, filenames=None):
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

    output = {}

    for filename in filenames if filenames is not None else []:
        content = context['filenames'].get(filename)
        if content is None or not hasattr(content, 'url'):
            raise RuntimeError('Don\'t know how to build %s' % filename)

        output[filename] = content.url

    settings['WRITE_SELECTED'] = output.values()

    writer = pelican.get_writer()

    for p in generators:
        if hasattr(p, 'generate_output'):
            p.generate_output(writer)

    signals.finalized.send(pelican)

    return output


def render(readers, fmt, content):
    f = tempfile.NamedTemporaryFile(delete=False)
    try:
        f.write(content.encode('utf-8'))
        f.close()
        return readers.readers[fmt].read(f.name)
    finally:
        os.unlink(f.name)


def reply(cmd_id, result, args=None):
    sys.stdout.write('%s %s %s\n' % (cmd_id, '+' if result else '-', json.dumps(args)))


def success(cmd_id, args=None):
    reply(cmd_id, True, args)


def fail(cmd_id, args=None):
    reply(cmd_id, False, args)


def run(config_file, init_settings):
    path = init_settings.pop('PATH', None)
    output_path = init_settings.pop('OUTPUT_PATH', None)
    theme = init_settings.pop('THEME', None)

    args = type('args', (object,), {
        'settings': config_file,
        'path': path,
        'output': output_path,
        'theme': theme,
        'delete_outputdir': None,
        'ignore_cache': True,
        'cache_path': None,
        'selected_paths': None,
        'verbosity': logging.DEBUG,
    })
    pelican, settings = get_instance(args)
    settings.update(init_settings)
    readers = Readers(settings)

    logging.info('Initialised pelican engine.')

    build(pelican, settings)

    sys.stdout.write('0 + %s\n' % json.dumps(settings))

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
        elif cmd == 'build':
            try:
                output = build(pelican, settings, args)
                success(cmd_id, output)
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        elif cmd == 'render':
            try:
                response = dict(zip(('content', 'metadata'), render(readers, *args)))
                response['metadata'] = None
                success(cmd_id, response)
            except Exception as e:
                print_exc()
                fail(cmd_id, str(e))
        else:
            fail(cmd_id, 'No such command')


if __name__ == '__main__':
    log_init(logging.DEBUG)
    run(sys.argv[1], json.loads(sys.argv[2]))
