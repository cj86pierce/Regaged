# Deploy: push from local, then run on VPS

## 1. Local (PowerShell) – push code

```powershell
cd c:\dev\regaged
git add -A
git status
git commit -m "your message"
git push origin main
```

## 2. VPS (SSH, bash) – pull, build, restart

```bash
cd /root/Regaged
git pull
npm run build
pm2 restart regaged
```
