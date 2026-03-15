# VPS Setup – Step by Step

## 1. Get the code onto your VPS

**Option A: Git (recommended)**  
From your local machine, commit and push:
```bash
git add Dockerfile docker-compose.yml entrypoint.sh .dockerignore next.config.js
git commit -m "Add VPS Docker deploy"
git push
```

On the VPS:
```bash
cd ~/Regaged
git pull
```

**Option B: Create files manually**  
If you don't use git, create these files on the VPS with the same contents as in the repo.

---

## 2. Install Docker (if needed)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 3. Create `.env`

```bash
cd ~/Regaged
cp .env.example .env
nano .env
```

Set these (replace with your values):

```
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://YOUR_SERVER_IP:3000
CRON_SECRET=<run: openssl rand -base64 24>
```

To generate secrets:
```bash
openssl rand -base64 32   # for NEXTAUTH_SECRET
openssl rand -base64 24   # for CRON_SECRET
```

*Do not change `DATABASE_URL` – docker-compose uses the built‑in Postgres.*

---

## 4. Build and run

```bash
cd ~/Regaged
sudo docker-compose up -d --build
```

The first build can take a few minutes.

---

## 5. Check it’s running

```bash
sudo docker-compose ps
curl http://localhost:3000
```

---

## 6. Cron (optional)

The app runs an **internal tick** when it starts (`src/instrumentation.ts`), so games advance every 60s without a system cron. If you want an external cron as well (e.g. redundancy), add:

```bash
crontab -e
```

Add (use your real CRON_SECRET and domain):

```
*/2 * * * * curl -s "http://localhost:3000/api/cron/tick?secret=YOUR_CRON_SECRET" > /dev/null 2>&1
```

---

## Troubleshooting

**Build fails**  
- Ensure `Dockerfile`, `entrypoint.sh`, and `output: "standalone"` in `next.config.js` are present.

**App won’t start**  
- Check logs: `sudo docker-compose logs -f app`

**Database connection errors**  
- Wait 30 seconds for Postgres to start, then `sudo docker-compose restart app`
