#!/bin/bash
# Install Brave managed policies to suppress kiosk popups (Rewards, updates promos, etc.)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_SRC="${REPO_ROOT}/deploy/brave-policies/smart-mirror.json"
POLICY_DIRS=(
  "/etc/brave/policies/managed"
  "/etc/opt/brave/policies/managed"
  "/etc/chromium/policies/managed"
)

if [[ ! -f "${POLICY_SRC}" ]]; then
  echo "[setup-brave-kiosk-policies] Policy file not found: ${POLICY_SRC}" >&2
  exit 1
fi

installed=0
for dir in "${POLICY_DIRS[@]}"; do
  if sudo mkdir -p "${dir}" 2>/dev/null; then
    sudo cp "${POLICY_SRC}" "${dir}/smart-mirror.json"
    sudo chmod 644 "${dir}/smart-mirror.json"
    echo "[setup-brave-kiosk-policies] Installed ${dir}/smart-mirror.json"
    installed=1
  fi
done

if [[ "${installed}" -eq 0 ]]; then
  echo "[setup-brave-kiosk-policies] Could not install policies (sudo required)." >&2
  exit 1
fi
