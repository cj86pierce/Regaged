/**
 * Picks a minigame for the given Castings day.
 * Deterministic: same game + day = same minigame for everyone.
 */

export const MINIGAME_IDS = ["matching", "match3"] as const;
export type MinigameId = (typeof MINIGAME_IDS)[number];

/** Simple hash for gameId + dayNumber. Returns 0..len-1 */
function hashToIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pickMinigameForDay(gameId: string, dayNumber: number): MinigameId {
  const seed = `${gameId}:${dayNumber}`;
  const idx = hashToIndex(seed) % MINIGAME_IDS.length;
  return MINIGAME_IDS[idx];
}
