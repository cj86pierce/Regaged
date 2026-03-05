# Deploy Regaged on a Linux VPS

One-time setup and every-time deploy steps.

## 1. One-time: Create `.env`

On the VPS, in the project root:

```bash
chmod +x scripts/*.sh
./scripts/vps-setup-env.sh
```

Then edit `.env` and set:

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/regaged` | Yes |
| `NEXTAUTH_SECRET` | Run `./scripts/generate-nextauth-secret.sh` (or `openssl rand -base64 32`) | Yes |
| `NEXTAUTH_URL` | `https://yourdomain.com` | Yes |
| `SUPABASE_URL` | (if using Supabase) | Optional |
| `SUPABASE_ANON_KEY` | (if using Supabase) | Optional |

Save the file.

## 2. Deploy and run

```bash
./scripts/vps-deploy.sh
```

This runs `npm install`, `npm run build`, and `npm start`. The app will listen on port 3000.

To stop: `Ctrl+C` (or kill the process).

## 3. (Optional) Use PM2 so it keeps running

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the command it prints so it restarts on reboot
```

After that, to deploy updates:

```bash
git pull   # or upload new code
USE_PM2=1 ./scripts/vps-deploy.sh
```

## 4. (Optional) Reverse proxy (nginx)

Point nginx (or Caddy) at `http://127.0.0.1:3000` and add SSL. Example nginx server block:

```nginx
server {
  listen 80;
  server_name yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then set `NEXTAUTH_URL=https://yourdomain.com` in `.env`.

## Quick check

- Open `https://yourdomain.com` (or `http://vps-ip:3000`).
- Try login; if it works, NextAuth and `.env` are correct.
