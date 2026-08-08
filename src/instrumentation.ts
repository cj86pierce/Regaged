/**
 * Runs when the Node server starts. Starts an internal tick so games advance
 * without relying on an external cron (PM2 regaged-cron, crontab, or cron-job.org).
 * The tick uses the same runTick() as /api/cron/tick.
 */

const TICK_INTERVAL_MS = Number(process.env.TICK_INTERVAL_MS) || 30_000;
const TICK_FIRST_DELAY_MS = 5_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CRON_DISABLED === "1") return;

  // Delay first tick so server is ready and we don't block startup
  setTimeout(() => {
    runTickOnce();
    setInterval(runTickOnce, TICK_INTERVAL_MS);
  }, TICK_FIRST_DELAY_MS);

  console.log(
    `[tick] Internal tick scheduled: first in ${TICK_FIRST_DELAY_MS / 1000}s, then every ${TICK_INTERVAL_MS / 1000}s`
  );
}

async function runTickOnce() {
  try {
    const { runTick } = await import("@/lib/runTick");
    const result = await runTick();
    if (result && "skipped" in result && result.skipped) return;
    if (result && typeof result === "object")
      console.log("[tick] ok", JSON.stringify(result).slice(0, 120));
  } catch (e) {
    console.error("[tick] failed", e instanceof Error ? e.message : e);
  }
}
