# Deploy Regaged on a Linux VPS

## Deploy (every time)

On the VPS, in the project root:

```bash
git pull
npm install
npm run build
npx prisma migrate deploy
pm2 restart all --update-env
```

Or use the script (then add migrate + restart):

```bash
git pull
USE_PM2=1 ./scripts/vps-deploy.sh
npx prisma migrate deploy
pm2 restart all --update-env
```

---

## One-time setup

### 1. Create `.env`

```bash
chmod +x scripts/*.sh
./scripts/vps-setup-env.sh
```

Edit `.env` and set at least: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CRON_SECRET`.

### 2. PM2 (app + tick cron)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

This starts both:
- **regaged** – the Next.js app
- **regaged-cron** – hits `/api/cron/tick` every 60s so games advance (Fasting rounds, Castings days, etc.) even when nobody has the tab open

Add `CRON_SECRET` to `.env` (e.g. `openssl rand -hex 16`). The cron script uses it to authenticate with the tick endpoint.

**If you already have only `regaged` running:** add the cron with:
```bash
pm2 start ecosystem.config.cjs --only regaged-cron
pm2 save
```

### 3. (Optional) Reverse proxy (nginx)

Point nginx at `http://127.0.0.1:3000`, add SSL, set `NEXTAUTH_URL` in `.env`.
