#!/bin/bash
# Fast-forward updates only; never replace an isolated or transitional release.
set -euo pipefail

project_dir=${SMART_MIRROR_PROJECT_DIR:-/home/smartmirror/Downloads/smart-mirror}
cd "$project_dir"

active_dir=$(systemctl show smart-mirror.service --property=WorkingDirectory --value)
if [ -z "$active_dir" ] || [ "$(realpath "$active_dir")" != "$(realpath "$project_dir")" ]; then
    echo "Skipping auto-deploy: startup selects another release. Promote a reviewed Git release first."
    exit 0
fi
if [ ! -f backend/src/api/nexus-routes.js ] || [ ! -f mobile-pwa/src/pages/Home.jsx ]; then
    echo "Skipping auto-deploy: this checkout does not contain the Nexus release."
    exit 0
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "Skipping auto-deploy: tracked local changes require review."
    exit 0
fi

# A failed fetch/pull/build must stop the updater, not report success.
git fetch origin main
local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse origin/main)
base_head=$(git merge-base HEAD origin/main)

if [ "$local_head" = "$remote_head" ]; then
    echo "System is up to date. No deployment needed."
elif [ "$local_head" = "$base_head" ]; then
    # The update channel must continue to contain Nexus and its TLS-only broker.
    git cat-file -e origin/main:backend/src/api/nexus-routes.js
    git cat-file -e origin/main:mobile-pwa/src/pages/Home.jsx
    if git show origin/main:docker-compose.yml | grep -Eq '1883:1883|compose.mqtt-migration'; then
        echo "Refusing auto-deploy: release still requires the plaintext MQTT migration."
        exit 1
    fi
    echo "Deploying fast-forward update: $local_head -> $remote_head"
    git pull --ff-only origin main
    docker compose config --quiet
    docker compose up -d --build
    healthy=false
    for attempt in $(seq 1 45); do
        if curl --fail --silent --max-time 2 http://127.0.0.1/api/health >/dev/null; then
            healthy=true
            break
        fi
        sleep 1
    done
    if [ "$healthy" != true ]; then
        echo "Deployment failed health verification. Inspect services; success was not recorded."
        exit 1
    fi
    echo "Update deployed and health verified."
elif [ "$remote_head" = "$base_head" ]; then
    echo "Local branch is ahead of origin/main. Skipping auto-deploy."
else
    echo "Local branch has diverged from origin/main. Skipping auto-deploy."
fi
