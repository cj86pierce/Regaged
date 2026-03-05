#!/usr/bin/env bash
# Run once on the VPS to create .env from .env.example.
# Then edit .env and set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL (and others as needed).

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists. Skipping. Edit it if you need to change values."
  exit 0
fi

if [ ! -f .env.example ]; then
  echo "ERROR: .env.example not found. Are you in the project root?"
  exit 1
fi

cp .env.example .env
echo "Created .env from .env.example."
echo ""
echo "Next steps:"
echo "  1. Edit .env and set at least:"
echo "     - DATABASE_URL   (PostgreSQL connection string)"
echo "     - NEXTAUTH_SECRET (run: openssl rand -base64 32)"
echo "     - NEXTAUTH_URL   (e.g. https://yourdomain.com)"
echo "  2. Run: npm install && npm run build && npm start"
echo "     Or use: ./scripts/vps-deploy.sh"
echo ""
