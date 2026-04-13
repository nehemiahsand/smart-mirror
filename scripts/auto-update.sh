#!/bin/bash
# Auto-update script for Smart Mirror CD (Continuous Deployment)

# Set the working directory to the project root
cd /home/smartmirror/Downloads/smart-mirror || exit

# Fetch the latest metadata from the remote repository
git fetch origin main

# Compare local head to remote head and only deploy when local is behind remote.
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base HEAD origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "[$(date)] System is up to date. No deployment needed."
elif [ "$LOCAL" = "$BASE" ]; then
    echo "[$(date)] New updates found! Local: $LOCAL | Remote: $REMOTE"
    
    # Pull the latest code as a fast-forward only update.
    git pull --ff-only origin main
    
    # Rebuild and restart the Docker containers in the background
    docker compose up -d --build
    
    echo "[$(date)] Update deployed successfully."
elif [ "$REMOTE" = "$BASE" ]; then
    echo "[$(date)] Local branch is ahead of origin/main. Skipping auto-deploy."
else
    echo "[$(date)] Local branch has diverged from origin/main. Skipping auto-deploy."
fi
