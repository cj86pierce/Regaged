import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";

const FASTING_MAX = 15;
const FASTING_NOM_MS = 2 * 60 * 1000;

const FASTING_STYLE_TYPES = ["FASTING", "FROOKIES", "ROOKIES"] as const;

export async function tryStartFastingGame(gameId: string) {
  return tryStartFastingStyleGame(gameId, "FASTING");
}

/** Start a fasting-style game (FASTING, FROOKIES, ROOKIES) when lobby is full. */
export async function tryStartFastingStyleGame(
  gameId: string,
  gameType: "FASTING" | "FROOKIES" | "ROOKIES"
) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game) return { ok: false, error: "Game not found" as const };
  if (!FASTING_STYLE_TYPES.includes(game.gameType as (typeof FASTING_STYLE_TYPES)[number]))
    return { ok: false, error: "Not a fasting-style game" as const };
  if (game.gameType !== gameType) return { ok: false, error: "Game type mismatch" as const };
  if (game.state !== "ENROLLING") return { ok: true, skipped: true as const };

  const count = await prisma.gamePlayer.count({
    where: { gameId, status: "ACTIVE" },
  });

  if (count < FASTING_MAX) return { ok: true, skipped: true as const };

  const now = new Date();

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      roundStartedAt: now,
      stateEndsAt: new Date(now.getTime() + FASTING_NOM_MS),
      povUserId: null,
    },
  });

  try {
    await assignFastingPov(gameId);
  } catch {
    // cron/state route will retry later
  }

  return { ok: true };
}
