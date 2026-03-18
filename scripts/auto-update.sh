#!/bin/bash
# Auto-update script for Smart Mirror CD (Continuous Deployment)

# Set the working directory to the project root
cd /home/smartmirror/Downloads/smart-mirror || exit

# Fetch the latest metadata from the remote repository
git fetch origin main

# Compare local head to remote head
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date)] New updates found! Local: $LOCAL | Remote: $REMOTE"
    
    # Pull the latest code
    git pull origin main
    
    # Rebuild and restart the Docker containers in the background
    docker compose up -d --build
    
    echo "[$(date)] Update deployed successfully."
else
    echo "[$(date)] System is up to date. No deployment needed."
fi
