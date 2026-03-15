/**
 * Start FASTING_BOT and CASTING_BOT games with 60-second rounds.
 * Does not modify original gameEngine / gameEngineCastings.
 */
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";

const BOT_ROUND_MS = 2 * 60 * 1000; // 2 min for testing
const FASTING_BOT_MAX = 15;
const CASTING_BOT_MAX = 20;

const FASTING_STYLE_BOT_TYPES = ["FASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT"] as const;

export async function tryStartFastingBotGame(gameId: string) {
  return tryStartFastingStyleBotGame(gameId, "FASTING_BOT");
}

export async function tryStartFastingStyleBotGame(
  gameId: string,
  gameType: "FASTING_BOT" | "FROOKIES_BOT" | "ROOKIES_BOT"
) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game || !FASTING_STYLE_BOT_TYPES.includes(game.gameType as (typeof FASTING_STYLE_BOT_TYPES)[number]) || game.state !== "ENROLLING")
    return { ok: false, skipped: true as const };
  if (game.gameType !== gameType) return { ok: false, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < FASTING_BOT_MAX) return { ok: true, skipped: true as const };

  const now = new Date();

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      roundStartedAt: now,
      stateEndsAt: new Date(now.getTime() + BOT_ROUND_MS),
      povUserId: null,
    },
  });

  try {
    await assignFastingPov(gameId);
  } catch {}

  return { ok: true };
}

export async function tryStartCastingBotGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game || game.gameType !== "CASTING_BOT" || game.state !== "ENROLLING") return { ok: false, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < CASTING_BOT_MAX) return { ok: true, skipped: true as const };

  const now = new Date();

  /**
   * Wiki: Day 1 has no nominees. Just set timer; catchUpCastingBotGame will expel 1 by algorithm at end.
   */
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_VOTE",
      roundNumber: 1,
      startsAt: now,
      castingDayStartedAt: now,
      stateEndsAt: new Date(now.getTime() + BOT_ROUND_MS),
    },
  });

  return { ok: true };
}
