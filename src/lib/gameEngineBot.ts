/**
 * Start FASTING_BOT and CASTING_BOT games with 60-second rounds.
 * Does not modify original gameEngine / gameEngineCastings.
 */
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";

const BOT_ROUND_MS = 60 * 1000;
const FASTING_BOT_MAX = 15;
const CASTING_BOT_MAX = 20;

export async function tryStartFastingBotGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game || game.gameType !== "FASTING_BOT" || game.state !== "ENROLLING") return { ok: false, skipped: true as const };

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

  await startCastingBotDay(gameId, 1);
  return { ok: true };
}

function checks(plus: number, minus: number) {
  return (plus ?? 0) - (minus ?? 0);
}

async function pickCastingNominees(gameId: string, nomineeCount: number): Promise<string[]> {
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, plusCount: true, minusCount: true, keys: true, health: true },
  });

  const list = rows.map((p) => ({
    userId: p.userId,
    keys: p.keys ?? 0,
    checks: checks(p.plusCount ?? 0, p.minusCount ?? 0),
    health: p.health ?? 70,
  }));

  list.sort((a, b) => {
    if (a.keys !== b.keys) return a.keys - b.keys;
    if (a.checks !== b.checks) return a.checks - b.checks;
    return a.health - b.health;
  });

  return list.slice(0, nomineeCount).map((x) => x.userId);
}

async function startCastingBotDay(gameId: string, dayNumber: number) {
  const { getSystemUserId } = await import("@/lib/systemUser");

  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const evictCount = activeCount >= 6 ? 2 : activeCount === 5 ? 1 : 0;
  const nomCount = evictCount === 2 ? 4 : evictCount === 1 ? 3 : 0;

  if (nomCount === 0) return;

  const nominees = await pickCastingNominees(gameId, nomCount);
  if (nominees.length === 0) return;

  await prisma.castingDayResult.upsert({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    update: { nomineeUserIds: nominees, evictedUserIds: [] },
    create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
  });

  const systemUserId = await getSystemUserId();
  await prisma.gameMessage.create({
    data: {
      gameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body: `[SYSTEM] Day ${dayNumber} voting has begun.`,
    },
  });
}
