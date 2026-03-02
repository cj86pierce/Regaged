#!/usr/bin/env node
/**
 * Dev cron runner - hits all cron endpoints every 60s.
 * Run alongside `npm run dev` so games advance even when no one is watching:
 *   node scripts/dev-cron.js
 *
 * Set BASE_URL if your app runs on a different port/host.
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const INTERVAL_MS = 60_000;

async function run(path) {
  try {
    const secret = process.env.CRON_SECRET;
    const url = secret ? `${BASE_URL}${path}?secret=${encodeURIComponent(secret)}` : `${BASE_URL}${path}`;
    const headers = secret ? { Authorization: `Bearer ${secret}` } : {};
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok) console.log(`[${path}] ok`, JSON.stringify(data).slice(0, 80));
    else console.warn(`[${path}] ${res.status}`, data);
  } catch (e) {
    console.warn(`[${path}] ${e.message}`);
  }
}

async function tick() {
  await Promise.all([
    run("/api/cron/fasting"),
    run("/api/cron/casting"),
    run("/api/cron/bot"),
  ]);
}

console.log(`Dev cron: pinging every ${INTERVAL_MS / 1000}s (BASE_URL=${BASE_URL})`);
tick();
setInterval(tick, INTERVAL_MS);
