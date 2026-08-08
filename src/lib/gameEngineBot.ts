/**
 * Start bot practice games — same rules as live, ~2 minute phases.
 */
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { BOT_ROUND_MS } from "@/lib/fastingTiming";
import { notifyGameStarted } from "@/lib/email/notifyGameStarted";

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
  if (
    !game ||
    !FASTING_STYLE_BOT_TYPES.includes(game.gameType as (typeof FASTING_STYLE_BOT_TYPES)[number]) ||
    game.state !== "ENROLLING"
  ) {
    return { ok: false, skipped: true as const };
  }
  if (game.gameType !== gameType) return { ok: false, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < FASTING_BOT_MAX) return { ok: true, skipped: true as const };

  const now = new Date();
  const isFrookiesBot = gameType === "FROOKIES_BOT";
  const isRookiesBot = gameType === "ROOKIES_BOT";

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      roundStartedAt: now,
      stateEndsAt: new Date(now.getTime() + BOT_ROUND_MS),
      povUserId: null,
      hohUserId: null,
      povSavedUserId: null,
      frookiesPhase: null,
    },
  });

  if (isRookiesBot) {
    try {
      await assignRookiesHoh(gameId, { random: true });
    } catch {}
    try {
      await assignFastingPov(gameId);
    } catch {}
  } else if (isFrookiesBot) {
    try {
      await assignFrookiesHoh(gameId, { random: true });
    } catch {}
  } else {
    try {
      await assignFastingPov(gameId);
    } catch {}
  }

  void notifyGameStarted(gameId);
  return { ok: true };
}

export async function tryStartCastingBotGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game || game.gameType !== "CASTING_BOT" || game.state !== "ENROLLING") {
    return { ok: false, skipped: true as const };
  }

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < CASTING_BOT_MAX) return { ok: true, skipped: true as const };

  const now = new Date();

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      castingDayStartedAt: now,
      stateEndsAt: new Date(now.getTime() + BOT_ROUND_MS),
    },
  });

  void notifyGameStarted(gameId);
  return { ok: true };
}
