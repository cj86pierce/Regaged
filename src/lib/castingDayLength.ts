/**
 * Casting day length in ms. Default 12 hours.
 * Set CASTING_DAY_SECONDS in env (e.g. 60) to use shorter days for testing.
 */
const DEFAULT_CASTING_DAY_MS = 12 * 60 * 60 * 1000;

export function getCastingDayMs(): number {
  const sec = process.env.CASTING_DAY_SECONDS;
  if (sec != null && sec !== "") {
    const n = parseInt(sec, 10);
    if (Number.isFinite(n) && n > 0) return n * 1000;
  }
  return DEFAULT_CASTING_DAY_MS;
}
