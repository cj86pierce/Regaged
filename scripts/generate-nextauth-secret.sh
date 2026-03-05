#!/usr/bin/env bash
# Generates a NEXTAUTH_SECRET you can paste into .env
# Usage: ./scripts/generate-nextauth-secret.sh

echo ""
echo "Add this line to your .env file:"
echo ""
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo ""
echo "Then save .env and redeploy if the app is already running."
echo ""
