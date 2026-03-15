import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";

const FASTING_MAX = 15;
const FASTING_NOM_MS = 2 * 60 * 1000;
const ROOKIES_DAY_MS = 24 * 60 * 60 * 1000;

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
  const isRookies = gameType === "ROOKIES";
  const isFrookies = gameType === "FROOKIES";
  const phaseMs = isRookies ? ROOKIES_DAY_MS : FASTING_NOM_MS;

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      roundStartedAt: now,
      stateEndsAt: new Date(now.getTime() + phaseMs),
      povUserId: null,
      hohUserId: null,
      povSavedUserId: null,
    },
  });

  if (isRookies) {
    try {
      await assignRookiesHoh(gameId, { random: true });
    } catch {
      // cron/state route will retry later
    }
  } else if (isFrookies) {
    try {
      await assignFrookiesHoh(gameId, { random: true });
    } catch {
      // cron/state route will retry later
    }
    // POV is assigned from competition (highest mini-game score) when phase ends
  } else {
    try {
      await assignFastingPov(gameId);
    } catch {
      // cron/state route will retry later
    }
  }

  return { ok: true };
}
