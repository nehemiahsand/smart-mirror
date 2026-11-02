#!/usr/bin/env python3
"""Create local MQTT TLS material and per-device credentials without printing secrets."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import subprocess


def run(*arguments):
    subprocess.run(arguments, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def private_file(path, content):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        stream.write(content)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default=str(Path(__file__).resolve().parents[1] / 'mosquitto'))
    parser.add_argument('--backend-user', required=True, help='Must match MQTT_USERNAME in backend/.env')
    parser.add_argument('--lan-ip', action='append', default=[])
    parser.add_argument('--dns-name', action='append', default=[])
    parser.add_argument('--renew-server', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9._-]{1,64}', args.backend_user):
        parser.error('Invalid backend username')
    root = Path(args.directory); certs = root / 'certs'; certs.mkdir(parents=True, exist_ok=True)
    if not (certs / 'ca.key').exists():
        if (certs / 'ca.pem').exists():
            parser.error('CA certificate exists without its key; restore the key rather than replacing trust')
        run('openssl', 'genrsa', '-out', str(certs / 'ca.key'), '4096')
        run('openssl', 'req', '-x509', '-new', '-sha256', '-key', str(certs / 'ca.key'), '-days', '3650', '-out', str(certs / 'ca.pem'), '-subj', '/CN=Nexus local MQTT CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
    os.chmod(certs / 'ca.key', 0o600)
    names = ['nehemiah-pi5', 'nehemiah-pi5.local', 'mosquitto', *args.dns_name]
    if any(not re.fullmatch(r'[a-zA-Z0-9.-]{1,253}', name) for name in names):
        parser.error('Invalid certificate DNS name')
    sans = [f'DNS:{name}' for name in names] + [f'IP:{ipaddress.ip_address(value)}' for value in args.lan_ip]
    if not (certs / 'server.pem').exists() or args.renew_server:
        run('openssl', 'genrsa', '-out', str(certs / 'server.key'), '2048')
        run('openssl', 'req', '-new', '-key', str(certs / 'server.key'), '-out', str(certs / 'server.csr'), '-subj', '/CN=nehemiah-pi5')
        (certs / 'server.ext').write_text('subjectAltName=' + ','.join(sans) + '\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\nbasicConstraints=CA:FALSE\n')
        run('openssl', 'x509', '-req', '-in', str(certs / 'server.csr'), '-CA', str(certs / 'ca.pem'), '-CAkey', str(certs / 'ca.key'), '-CAcreateserial', '-days', '397', '-sha256', '-extfile', str(certs / 'server.ext'), '-out', str(certs / 'server.pem'))
    os.chmod(certs / 'server.key', 0o640)
    for certificate in ['ca.pem', 'server.pem']:
        os.chmod(certs / certificate, 0o644)
    if os.geteuid() == 0:
        os.chown(certs / 'server.key', 1883, 1883)
    credentials_path = root / 'credentials.json'
    values = json.loads(credentials_path.read_text()) if credentials_path.exists() else {}
    ids = ['mirror-entry-1', 'smart-clock', 'mirror', 'mac', 'thinkpad']
    if args.backend_user in ids:
        parser.error('The backend account must be distinct from device accounts')
    for device_id in ids:
        values.setdefault(device_id, secrets.token_hex(24))
    values.setdefault('httpBearerToken', secrets.token_hex(32)); values.setdefault('otaPassword', secrets.token_hex(24))
    private_file(credentials_path, json.dumps(values, indent=2))
    private_file(root / 'clients.local', ''.join(f'{device_id}:{values[device_id]}\n' for device_id in ids))
    acl = [f'user {args.backend_user}', 'topic readwrite smartmirror/#', '']
    for device_id in ids:
        prefix = f'smartmirror/esp32/{device_id}' if device_id in ['mirror-entry-1', 'smart-clock'] else f'smartmirror/devices/{device_id}'
        acl += [f'user {device_id}', f'topic read {prefix}/command']
        for topic in ['status', 'event', 'state', 'response'] if device_id == 'smart-clock' else ['status', 'event'] if device_id == 'mirror-entry-1' else ['status', 'telemetry', 'response']:
            acl.append(f'topic write {prefix}/{topic}')
        acl.append('')
    acl_path = root / 'acl.local'
    acl_path.write_text('\n'.join(acl))
    os.chmod(acl_path, 0o640 if os.geteuid() == 0 else 0o644)
    if os.geteuid() == 0:
        os.chown(acl_path, 1883, 1883)
    template = '#pragma once\n// Adapt constant names to the separate clock firmware. Keep this file ignored.\n'
    template += 'constexpr char MQTT_CA_PEM[] = R"PEM(' + (certs / 'ca.pem').read_text() + ')PEM";\n'
    template += 'constexpr char MQTT_USERNAME[] = "smart-clock";\n'
    template += f'constexpr char MQTT_PASSWORD[] = "{values["smart-clock"]}";\n'
    template += f'constexpr char HTTP_BEARER_TOKEN[] = "{values["httpBearerToken"]}";\n'
    template += f'constexpr char OTA_PASSWORD[] = "{values["otaPassword"]}";\n'
    private_file(certs / 'clock-secrets.h', template)
    print('MQTT certificates, ACLs, and ignored provisioning files are ready. No live services were changed.')
    if os.geteuid() != 0:
        print('Before Pi deployment, grant UID/GID 1883 read access to server.key and acl.local (mode 0640).')


if __name__ == '__main__':
    main()
