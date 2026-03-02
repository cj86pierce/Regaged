/**
 * Casting day length in ms. Default 12 hours.
 * Set CASTING_DAY_SECONDS in env (e.g. 60) to use shorter days for testing.
 */
const DEFAULT_CASTING_DAY_MS = 12 * 60 * 60 * 1000;
export const BOT_DAY_MS = 60 * 1000; // 60 seconds for bot games

export function getCastingDayMs(): number {
  const sec = process.env.CASTING_DAY_SECONDS;
  if (sec != null && sec !== "") {
    const n = parseInt(sec, 10);
    if (Number.isFinite(n) && n > 0) return n * 1000;
  }
  return DEFAULT_CASTING_DAY_MS;
}

/** Returns 60s for CASTING_BOT games, else getCastingDayMs() */
export async function getDayMsForGame(gameId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true },
  });
  if (game?.gameType === "CASTING_BOT") return BOT_DAY_MS;
  return getCastingDayMs();
}
