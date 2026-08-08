/**
 * Fastings / Frookies round phase lengths.
 *
 * Tengaged FAQ does not publish exact Fastings round minutes (only the
 * final-3 12-hour clock). Defaults are production-friendly "fast" pacing;
 * override with FASTING_NOM_SECONDS / FASTING_VOTE_SECONDS for testing.
 */

const DEFAULT_NOM_MS = 8 * 60 * 1000;
const DEFAULT_VOTE_MS = 5 * 60 * 1000;
export const FINAL3_MS = 12 * 60 * 60 * 1000;
export const BOT_ROUND_MS = 2 * 60 * 1000;

function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n * 1000;
}

export function getFastingNomMs(): number {
  return envMs("FASTING_NOM_SECONDS", DEFAULT_NOM_MS);
}

export function getFastingVoteMs(): number {
  return envMs("FASTING_VOTE_SECONDS", DEFAULT_VOTE_MS);
}

export function getFinal3Ms(isBot: boolean): number {
  if (isBot) return BOT_ROUND_MS;
  return envMs("FASTING_FINAL3_SECONDS", FINAL3_MS);
}

/** Rookies day length: 24h live, 2 min bot practice. */
export function getRookiesDayMs(isBot: boolean): number {
  return isBot ? BOT_ROUND_MS : 24 * 60 * 60 * 1000;
}

/** Frookies POV save window after noms. */
export function getFrookiesPovSaveMs(isBot: boolean): number {
  if (isBot) return Math.min(45_000, BOT_ROUND_MS);
  return Math.min(5 * 60_000, getFastingVoteMs());
}

/** Frookies HOH renom window after POV saves a nominee. */
export function getFrookiesHohRenomMs(isBot: boolean): number {
  return isBot ? Math.min(30_000, BOT_ROUND_MS) : 60_000;
}

export function isBotGameType(gameType: string): boolean {
  return (
    gameType === "FASTING_BOT" ||
    gameType === "CASTING_BOT" ||
    gameType === "FROOKIES_BOT" ||
    gameType === "ROOKIES_BOT"
  );
}
