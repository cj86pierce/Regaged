# VPS Deployment Guide

## Prerequisites

- VPS with Docker & Docker Compose (Ubuntu 22.04 recommended)
- Domain pointed to your VPS (optional, for HTTPS)

## Quick start (Docker Compose)

1. **Clone and configure**

   ```bash
   cd /opt/regaged  # or your app dir
   git clone <your-repo> .
   cp .env.example .env
   ```

2. **Edit `.env`**

   ```env
   DATABASE_URL=postgresql://regaged:regaged@db:5432/regaged
   NEXTAUTH_URL=https://yourdomain.com
   NEXTAUTH_SECRET=<generate: openssl rand -base64 32>
   CRON_SECRET=<optional: for cron routes>
   ```

3. **Update docker-compose** if using external Postgres – set `DATABASE_URL` to your DB and remove the `db` service and `depends_on`.

4. **Build and run**

   ```bash
   docker compose up -d --build
   ```

5. **Cron (required for games)**

   Add a cron job to hit the tick endpoint:

   ```bash
   */2 * * * * curl -s "https://yourdomain.com/api/cron/tick?secret=YOUR_CRON_SECRET" > /dev/null 2>&1
   ```

   Or use Vercel Cron if you deploy there instead.

---

## Production checklist

- [ ] Set strong passwords in `DATABASE_URL` and `NEXTAUTH_SECRET`
- [ ] Set `NEXTAUTH_URL` to your real URL (e.g. `https://regaged.example.com`)
- [ ] Add reverse proxy (nginx/Caddy) for HTTPS
- [ ] Configure firewall (allow 80, 443; block 3000 if behind proxy)
- [ ] Add cron job for `/api/cron/tick`
- [ ] Use a managed Postgres or backup the `pgdata` volume

---

## Nginx reverse proxy (HTTPS)

```nginx
server {
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

Use Certbot for Let’s Encrypt: `certbot --nginx -d yourdomain.com`
