/**
 * Picks a minigame for the given Castings/Frookies day.
 * Deterministic: same game + day = same minigame for everyone.
 */

import { MINIGAME_IDS, type MinigameId, getMinigameDef } from "@/lib/minigames/registry";

export { MINIGAME_IDS, getMinigameDef };
export type { MinigameId };

/** Simple hash for gameId + dayNumber. */
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

export function minigameDisplayName(id: MinigameId): string {
  return getMinigameDef(id).name;
}
