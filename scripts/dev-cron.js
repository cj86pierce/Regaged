#!/usr/bin/env node
/**
 * Tick cron - hits /api/cron/tick every 60s so games advance.
 * Run alongside the app (dev or VPS):
 *   node scripts/dev-cron.js
 *
 * On VPS: use PM2 - ecosystem.config.cjs includes regaged-cron.
 * Set BASE_URL if your app runs on a different port. Uses CRON_SECRET from .env.
 */
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
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
  await run("/api/cron/tick");
}

console.log(`Dev cron: pinging every ${INTERVAL_MS / 1000}s (BASE_URL=${BASE_URL})`);
tick();
setInterval(tick, INTERVAL_MS);
