import asyncio
import json
import os
import sys


class RunnerProtocol(asyncio.SubprocessProtocol):
    def __init__(self, callback=None):
        self.callback = callback
        self.stdin = None
        self.seq = 0
        self.buffer = ''
        self.pending = set()

    def connection_made(self, transport):
        self.stdin = transport.get_pipe_transport(0)

    def send_command(self, command, args=None):
        self.seq += 1
        self.pending.add(self.seq)
        self.stdin.write(('%d %s %s\n' % (self.seq, command, json.dumps(args))).encode('utf8'))
        return self.seq

    def pipe_data_received(self, fd, data):
        if fd == 1:
            self.buffer += data.decode('utf8')
            while '\n' in self.buffer:
                response, self.buffer = self.buffer.split('\n', 1)
                self.process_response(response)
        else:
            sys.stderr.write(data.decode('utf8'))

    def process_response(self, response):
        seq, result, args = response.split(' ', 2)
        seq = int(seq)
        if seq in self.pending:
            self.pending.remove(seq)
        args = json.loads(args)
        if self.callback is not None:
            self.callback(seq, result == '+', args)

    def process_exited(self):
        pending, self.pending = self.pending, set()
        while pending:
            self.callback(pending.pop(), False, 'Process exited')


class Runner(object):
    def __init__(self, python, config_path, settings, **kwargs):
        loop = kwargs.get('loop')
        if loop is None:
            loop = asyncio.get_event_loop()
        self.loop = loop

        self.python = python
        self.config_path = config_path
        self.init_settings = settings

        self.settings = None
        self.d = None
        self.pending = {}
        self.transport = None
        self.protocol = None

    @asyncio.coroutine
    def start(self):
        self.d = asyncio.Future()
        runner = os.path.join(os.path.dirname(__file__), '..', 'pelican-runner.py')
        self.transport, self.protocol = yield from self.loop.subprocess_exec(
            lambda: RunnerProtocol(self.response_received),
            self.python,
            runner,
            self.config_path,
            json.dumps(self.init_settings)
        )
        yield from self.d

    @asyncio.coroutine
    def restart(self):
        yield from self.command('quit')
        yield from self.start()

    @asyncio.coroutine
    def command(self, command, args=None):
        command_id = self.protocol.send_command(command, args)
        f = asyncio.Future()
        self.pending[command_id] = f
        return (yield from f)

    def response_received(self, command_seq, success, args):
        if command_seq == 0:
            self.settings = args
            if self.d:
                self.d.set_result(args)
                self.d = None
            return

        f = self.pending.pop(command_seq)
        if success:
            f.set_result(args)
        else:
            f.set_exception(RuntimeError(args))
