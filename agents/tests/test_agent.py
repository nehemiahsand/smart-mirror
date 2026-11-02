import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('nexus_agent', Path(__file__).resolve().parents[1] / 'nexus_agent.py')
agent_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent_module)


class AgentTests(unittest.TestCase):
    def test_configuration_rejects_insecure_permissions_and_arbitrary_services(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'config.json'
            value = {'deviceId': 'mac', 'host': 'broker', 'username': 'mac', 'password': 'test', 'caFile': '/public/ca.pem'}
            file.write_text(json.dumps(value)); file.chmod(0o644)
            with self.assertRaises(ValueError):
                agent_module.load_config(file)
            file.chmod(0o600)
            self.assertEqual(agent_module.load_config(file)['deviceId'], 'mac')
            value['services'] = {'evil': {'manager': 'systemd', 'unit': 'web; touch /tmp/test'}}
            file.write_text(json.dumps(value))
            with self.assertRaises(ValueError):
                agent_module.load_config(file)

    def test_fixed_service_arguments_and_opt_in_capabilities(self):
        config = {'services': {'web': {'manager': 'systemd-user', 'unit': 'web.service'}}}
        self.assertEqual(agent_module.capabilities(config), ['restart-service:web'])
        self.assertEqual(agent_module.service_args(config['services']['web'], True), ['/usr/bin/systemctl', '--user', 'restart', 'web.service'])
        self.assertNotIn('reboot', agent_module.capabilities(config))

    def make_agent(self, directory):
        agent = agent_module.Agent.__new__(agent_module.Agent)
        agent.config = {'deviceId': 'mac', 'services': {'web': {'manager': 'systemd-user', 'unit': 'web.service'}}}
        agent.prefix = 'smartmirror/devices/mac'; agent.seen = {}; agent.state_path = Path(directory) / 'requests.json'; agent.state_lock = threading.Lock()
        agent.respond = Mock(); agent.execute = Mock()
        return agent

    def message(self, command, retained=False):
        return type('Message', (), {'retain': retained, 'topic': 'smartmirror/devices/mac/command', 'payload': json.dumps(command).encode()})()

    def test_expired_retained_and_unsupported_commands_never_execute(self):
        with tempfile.TemporaryDirectory() as directory:
            agent = self.make_agent(directory)
            for command in [
                {'requestId': 'expired', 'action': 'restart-service:web', 'expiresAt': 0},
                {'requestId': 'power', 'action': 'reboot', 'expiresAt': time.time() * 1000 + 10000},
                {'requestId': 'shell', 'action': 'sh -c anything', 'expiresAt': time.time() * 1000 + 10000},
            ]:
                agent.on_message(None, None, self.message(command))
            agent.on_message(None, None, self.message({'requestId': 'retained'}, True))
            agent.execute.assert_not_called()
            self.assertFalse(agent.state_path.exists())

    def test_duplicate_id_is_persisted_before_action_and_never_executes_twice(self):
        with tempfile.TemporaryDirectory() as directory:
            agent = self.make_agent(directory)
            command = {'requestId': 'one', 'action': 'restart-service:web', 'expiresAt': time.time() * 1000 + 10000}
            with patch.object(agent_module.threading, 'Thread') as thread:
                agent.on_message(None, None, self.message(command))
                self.assertIn('one', json.loads(agent.state_path.read_text()))
                thread.assert_called_once()
                agent.on_message(None, None, self.message(command))
                thread.assert_called_once()
            self.assertEqual(agent.state_path.stat().st_mode & 0o777, 0o600)


if __name__ == '__main__':
    unittest.main()
