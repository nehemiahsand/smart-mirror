#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDLER="${REPO_ROOT}/scripts/browser-mode.sh"
CONFIG_DIR="${XDG_CONFIG_HOME:-/home/smartmirror/.config}/labwc"
CONFIG_FILE="${CONFIG_DIR}/rc.xml"

mkdir -p "${CONFIG_DIR}"

python3 - "${CONFIG_FILE}" "${HANDLER}" <<'PY'
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

config_path = Path(sys.argv[1])
handler = sys.argv[2]
namespace = 'http://openbox.org/3.4/rc'
ET.register_namespace('', namespace)

if config_path.exists():
    backup_path = config_path.with_name('rc.xml.pre-smart-mirror')
    if not backup_path.exists():
        shutil.copy2(config_path, backup_path)
    tree = ET.parse(config_path)
    root = tree.getroot()
else:
    root = ET.Element(f'{{{namespace}}}openbox_config')
    tree = ET.ElementTree(root)

def qualified(name):
    return f'{{{namespace}}}{name}'

keyboard = root.find(qualified('keyboard'))
if keyboard is None:
    keyboard = ET.SubElement(root, qualified('keyboard'))

bindings = {
    'Escape': f'{handler} browse',
    'C-A-m': f'{handler} mirror',
}

for key, command in bindings.items():
    for existing in list(keyboard.findall(qualified('keybind'))):
        if existing.get('key', '').lower() == key.lower():
            keyboard.remove(existing)

    keybind = ET.SubElement(keyboard, qualified('keybind'), {'key': key})
    action = ET.SubElement(keybind, qualified('action'), {'name': 'Execute'})
    ET.SubElement(action, qualified('command')).text = command

ET.indent(tree, space='  ')
temporary_path = config_path.with_suffix('.xml.tmp')
tree.write(temporary_path, encoding='utf-8', xml_declaration=True)
temporary_path.replace(config_path)
PY

# Reload the running Raspberry Pi OS compositor. It is harmless if this script
# runs before the desktop session is ready; the config is read at login too.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
labwc --reconfigure 2>/dev/null || true
