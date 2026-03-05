#!/usr/bin/env bash
# Run on the VPS to install, build, and start the app.
# Usage: ./scripts/vps-deploy.sh
# Optional: USE_PM2=1 ./scripts/vps-deploy.sh  to restart via PM2 instead of npm start

set -e
cd "$(dirname "$0")/.."

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

if [ -n "$USE_PM2" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    echo "Restarting with PM2..."
    pm2 restart regaged --update-env 2>/dev/null || pm2 start npm --name regaged -- start
  else
    echo "PM2 not found. Install with: npm install -g pm2"
    echo "Starting with npm start instead..."
    npm start
  fi
else
  echo "Starting (npm start). Use USE_PM2=1 ./scripts/vps-deploy.sh to use PM2."
  npm start
fi
