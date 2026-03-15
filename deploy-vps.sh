#!/bin/bash
# Run on VPS: pull, build, restart
cd /root/Regaged
git pull
npm run build
pm2 restart regaged
