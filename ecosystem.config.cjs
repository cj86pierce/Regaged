/**
 * PM2 ecosystem file for VPS.
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup   # persist across reboots
 *
 * Loads .env from the project directory (same folder as this file).
 */
module.exports = {
  apps: [
    {
      name: "regaged",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
    // Optional: external tick (app already runs internal tick via instrumentation.ts)
    {
      name: "regaged-cron",
      script: "scripts/dev-cron.js",
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        BASE_URL: "http://localhost:3000",
      },
      env_file: ".env",
    },
  ],
};
