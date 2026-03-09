# Deploy Regaged on a Linux VPS

## Deploy (every time)

On the VPS, in the project root:

```bash
git pull
npm install
npm run build
pm2 restart regaged --update-env
```

Or use the script:

```bash
git pull
USE_PM2=1 ./scripts/vps-deploy.sh
```

---

## One-time setup

### 1. Create `.env`

```bash
chmod +x scripts/*.sh
./scripts/vps-setup-env.sh
```

Edit `.env` and set at least: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

### 2. PM2 (keeps app running)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 3. (Optional) Reverse proxy (nginx)

Point nginx at `http://127.0.0.1:3000`, add SSL, set `NEXTAUTH_URL` in `.env`.
