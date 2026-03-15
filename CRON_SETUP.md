# Cron setup for game advancement

**On a long-running Node server (e.g. VPS with PM2):** The app runs an **internal tick** when the server starts (`src/instrumentation.ts`), so games advance every 60s without any external cron. You can skip external cron entirely.

**On Vercel (or if you want external redundancy):** Games advance when something hits the tick endpoint. **vercel.json** is set to `*/1 * * * *` (every minute). On **Vercel Hobby**, crons are limited to once per day—use an external cron (Option 1) so casting and fasting don’t stay stuck.

## Option 1: External cron (recommended for Hobby)

Use [cron-job.org](https://cron-job.org) (free) to hit your tick endpoint every minute:

1. Sign up at cron-job.org
2. Create a cron job:
   - **URL:** `https://YOUR_APP.vercel.app/api/cron/tick?secret=YOUR_CRON_SECRET`
   - **Schedule:** Every minute (`* * * * *`)
   - **Method:** GET

3. Add `CRON_SECRET` to your Vercel env vars (e.g. `openssl rand -hex 16`) and use the same value in the URL.

4. **Casting days are 12 hours by default.** For faster advancement during testing, add `CASTING_DAY_SECONDS=60` to Vercel env vars.

## Option 2: Vercel Pro

On Pro, per-minute crons work. You can add multiple cron paths in `vercel.json` with `*/1 * * * *` if you prefer separate endpoints.

## Option 3: Local development

Run the dev cron script alongside `npm run dev`:

```bash
node scripts/dev-cron.js
```

The script hits `/api/cron/tick`, which handles fasting, casting, and bot games.

## Troubleshooting

- **401 Unauthorized:** Ensure `CRON_SECRET` in Vercel matches the `?secret=` value in your cron URL (no extra spaces or quotes).
- **500 error:** Check Vercel Function logs. The tick returns the error message in the response body for debugging.
