import json
import os
import sys
from twisted.internet import defer, protocol


class RunnerProtocol(protocol.ProcessProtocol):
    def __init__(self, callback):
        self.callback = callback
        self.seq = 0
        self.buffer = ''
        self.pending = set()

    def sendCommand(self, command, args=None):
        self.seq += 1
        self.pending.add(self.seq)
        self.transport.write('%d %s %s\n' % (self.seq, command, json.dumps(args)))
        return self.seq

    def outReceived(self, data):
        self.buffer += data
        while '\n' in self.buffer:
            response, self.buffer = self.buffer.split('\n', 1)
            self.process_response(response)

    def process_response(self, response):
        seq, result, args = response.split(' ', 2)
        seq = int(seq)
        if seq in self.pending:
            self.pending.remove(seq)
        args = json.loads(args)
        if self.callback is not None:
            self.callback(seq, result == '+', args)

    def processExited(self, reason):
        pending, self.pending = self.pending, set()
        while pending:
            self.callback(pending.pop(), False, reason)


class Runner(object):
    def __init__(self, python, config_path, settings, **kwargs):
        reactor = kwargs.get('reactor')
        if reactor is None:
            from twisted.internet import reactor
        self.reactor = reactor

        self.python = python
        self.config_path = config_path
        self.init_settings = settings

        self.settings = None
        self.d = None
        self.pending = {}

    def start(self):
        self.d = defer.Deferred()
        runner = os.path.join(os.path.dirname(__file__), 'pelican-runner.py')
        protocol = RunnerProtocol(self.responseReceived)
        self.transport = self.reactor.spawnProcess(
            protocol,
            self.python,
            [
                'pelicide-runner',
                '-u',
                runner,
                self.config_path,
                json.dumps(self.init_settings),
            ],
            childFDs={
                0: 'w',
                1: 'r',
                2: sys.stderr.fileno(),
            },
        )
        return self.d

    def restart(self):
        return self.command('quit').addCallback(lambda _: self.start())

    def command(self, command, args=None):
        if self.transport.proto is None:
            self.start()
        command_id = self.transport.proto.sendCommand(command, args)
        d = defer.Deferred()
        self.pending[command_id] = d
        return d

    def responseReceived(self, command_seq, success, args):
        if command_seq == 0:
            self.settings = args
            if self.d:
                self.d.callback(args)
                self.d = None
            return

        d = self.pending.pop(command_seq)
        if success:
            d.callback(args)
        else:
            d.errback(defer.fail(RuntimeError(args)))
