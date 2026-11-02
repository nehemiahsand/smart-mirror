#!/usr/bin/env python3
"""Nexus host telemetry and opt-in, named maintenance actions over verified MQTT TLS."""
import argparse
import json
import os
from pathlib import Path
import platform
import re
import signal
import ssl
import subprocess
import sys
import threading
import time

import paho.mqtt.client as mqtt
import psutil

ID = re.compile(r"^[a-z0-9._-]{1,64}$")
UNIT = re.compile(r"^[a-zA-Z0-9._@-]{1,120}$")


def atomic_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(value, stream)
    os.replace(temporary, path)


def load_config(path):
    path = Path(path)
    if path.stat().st_mode & 0o077:
        raise ValueError('Agent configuration must have mode 0600')
    config = json.loads(path.read_text())
    if not ID.fullmatch(config.get('deviceId', '')):
        raise ValueError('Invalid device ID')
    for field in ['host', 'username', 'password', 'caFile']:
        if not isinstance(config.get(field), str) or not config[field]:
            raise ValueError('Missing MQTT configuration')
    if config.get('port', 8883) != 8883:
        raise ValueError('Only MQTT TLS on port 8883 is supported')
    services = config.get('services', {})
    if len(services) > 20:
        raise ValueError('Too many service entries')
    for alias, service in services.items():
        if not ID.fullmatch(alias) or not UNIT.fullmatch(service.get('unit', '')):
            raise ValueError('Invalid service allowlist')
        if service.get('manager') not in ['systemd-user', 'systemd', 'launchd']:
            raise ValueError('Unsupported service manager')
    return config


def service_args(service, restart=False):
    manager, unit = service['manager'], service['unit']
    if manager.startswith('systemd'):
        return ['/usr/bin/systemctl', *(['--user'] if manager == 'systemd-user' else []), 'restart' if restart else 'is-active', unit]
    return ['/bin/launchctl', 'kickstart', '-k', f'gui/{os.getuid()}/{unit}'] if restart else ['/bin/launchctl', 'print', f'gui/{os.getuid()}/{unit}']


def capabilities(config):
    result = [f'restart-service:{alias}' for alias in config.get('services', {})]
    if config.get('allowPower') is True:
        result += ['reboot', 'shutdown']
    return result


def collect(config):
    measurements = {
        'hostname': platform.node(), 'platform': platform.system(),
        'cpuPercent': psutil.cpu_percent(interval=None),
        'memoryPercent': psutil.virtual_memory().percent,
        'diskPercent': psutil.disk_usage(config.get('diskPath', '/')).percent,
        'uptimeSeconds': max(0, time.time() - psutil.boot_time()),
        'network': ', '.join(name for name, data in psutil.net_if_stats().items() if data.isup and name not in ['lo', 'lo0'])[:200],
        'services': {},
    }
    if hasattr(psutil, 'sensors_temperatures'):
        values = [entry.current for entries in psutil.sensors_temperatures().values() for entry in entries if entry.current is not None and entry.current >= 0]
        if values:
            measurements['temperatureC'] = round(max(values), 1)
    battery = psutil.sensors_battery()
    if battery:
        measurements['batteryPercent'] = battery.percent
    for alias, service in config.get('services', {}).items():
        try:
            result = subprocess.run(service_args(service), capture_output=True, timeout=3, check=False)
            measurements['services'][alias] = 'active' if result.returncode == 0 else 'inactive'
        except (OSError, subprocess.TimeoutExpired):
            measurements['services'][alias] = 'unknown'
    return {'measurements': measurements, 'capabilities': capabilities(config)}


class Agent:
    def __init__(self, config):
        self.config = config
        self.prefix = f"smartmirror/devices/{config['deviceId']}"
        self.state_path = Path(config.get('stateFile', str(Path.home() / '.local/state/nexus-agent/requests.json')))
        try:
            self.seen = json.loads(self.state_path.read_text())
            if not isinstance(self.seen, dict):
                raise ValueError('Invalid request store')
        except FileNotFoundError:
            self.seen = {}
        self.running = True
        self.state_lock = threading.Lock()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"nexus-agent-{config['deviceId']}", clean_session=True)
        self.client.username_pw_set(config['username'], config['password'])
        context = ssl.create_default_context(cafile=config['caFile'])
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        self.client.tls_set_context(context)
        self.client.will_set(self.prefix + '/status', json.dumps({'online': False}), qos=1, retain=True)
        self.client.reconnect_delay_set(1, 15)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            client.subscribe(self.prefix + '/command', qos=0)
            client.publish(self.prefix + '/status', json.dumps({'online': True}), qos=1, retain=True)

    def respond(self, payload):
        return self.client.publish(self.prefix + '/response', json.dumps(payload), qos=0, retain=False)

    def on_message(self, client, userdata, message):
        if message.retain or len(message.payload) > 4096 or message.topic != self.prefix + '/command':
            return
        try:
            command = json.loads(message.payload)
            request_id, action = command['requestId'], command['action']
            now = time.time() * 1000
            if not re.fullmatch(r'[a-zA-Z0-9._:-]{1,96}', request_id):
                return
            if request_id in self.seen:
                self.respond(self.seen[request_id])
                return
            if not isinstance(command.get('expiresAt'), (int, float)) or not now < command['expiresAt'] <= now + 16000 or action not in capabilities(self.config):
                self.respond({'requestId': request_id, 'ok': False, 'error': 'expired_or_unsupported'})
                return
            # Persist before invoking an action. A restarted agent never repeats it.
            response = {'requestId': request_id, 'ok': True, 'outcome': 'accepted'}
            with self.state_lock:
                self.seen[request_id] = response
                self.seen = dict(list(self.seen.items())[-100:])
                atomic_write(self.state_path, self.seen)
            acknowledgement = self.respond(response)
            threading.Thread(target=self.execute, args=(request_id, action, acknowledgement), daemon=True).start()
        except (ValueError, KeyError, TypeError, OSError, subprocess.TimeoutExpired):
            # Never log a command payload, credentials, or subprocess output.
            print('Agent command could not be completed', file=sys.stderr)

    def execute(self, request_id, action, acknowledgement):
        try:
            acknowledgement.wait_for_publish(timeout=2)
            if not acknowledgement.is_published():
                raise RuntimeError('Acknowledgement could not be delivered')
            if action.startswith('restart-service:'):
                arguments = service_args(self.config['services'][action.split(':', 1)[1]], restart=True)
            elif platform.system() == 'Darwin':
                arguments = ['/sbin/shutdown', '-r' if action == 'reboot' else '-h', 'now']
            else:
                arguments = ['/usr/bin/systemctl', 'reboot' if action == 'reboot' else 'poweroff']
            result = subprocess.run(arguments, capture_output=True, timeout=10, check=False)
            ok = result.returncode == 0
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            ok = False
        response = {'requestId': request_id, 'ok': ok, 'outcome': 'completed' if ok else 'failed'}
        if not ok:
            response['error'] = 'local_action_failed'
        with self.state_lock:
            self.seen[request_id] = response
            atomic_write(self.state_path, self.seen)
        self.respond(response)

    def run(self):
        self.client.connect_async(self.config['host'], 8883, keepalive=30)
        self.client.loop_start()
        try:
            while self.running:
                if self.client.is_connected():
                    try:
                        self.client.publish(self.prefix + '/telemetry', json.dumps(collect(self.config)), qos=0, retain=False)
                    except (OSError, psutil.Error):
                        print('Telemetry collection failed', file=sys.stderr)
                for _ in range(15):
                    if not self.running:
                        break
                    time.sleep(1)
        finally:
            if self.client.is_connected():
                self.client.publish(self.prefix + '/status', json.dumps({'online': False}), qos=0, retain=True).wait_for_publish(timeout=2)
            self.client.disconnect()
            self.client.loop_stop()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    arguments = parser.parse_args()
    agent = Agent(load_config(arguments.config))
    signal.signal(signal.SIGTERM, lambda *_: setattr(agent, 'running', False))
    signal.signal(signal.SIGINT, lambda *_: setattr(agent, 'running', False))
    agent.run()


if __name__ == '__main__':
    main()
