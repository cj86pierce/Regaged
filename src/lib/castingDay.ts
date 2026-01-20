import { prisma } from "@/lib/prisma";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

// lower score => more likely nominated (lowest checks first, keys immunity handled elsewhere)
function score(p: { checks: number; keys: number }) {
  // keys matter first (lower keys get hit), then checks
  // we encode this by weighting keys heavily
  return p.keys * 100000 + p.checks;
}

export async function startCastingDay(gameId: string, dayNumber: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game || game.gameType !== "CASTING") return;

  // Determine how many evictions we need to reach final 4
  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const evictCount = activeCount >= 6 ? 2 : activeCount === 5 ? 1 : 0;
  const nomineeCount = evictCount === 2 ? 4 : evictCount === 1 ? 3 : 0;

  if (nomineeCount === 0) {
    // final day or too small; keep state as-is
    return;
  }

  // Build candidate list with keys + checks
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true },
  });

  const ranked = players
    .map((p) => ({
      userId: p.userId,
      keys: p.keys ?? 0,
      checks: (p.plusCount ?? 0) - (p.minusCount ?? 0),
    }))
    // lowest keys first; within that lowest checks first
    .sort((a, b) => score(a) - score(b));

  const nominees = ranked.slice(0, nomineeCount).map((p) => p.userId);

  // upsert day record using nomineeUserIds array field
  await prisma.castingDayResult.upsert({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    update: { nomineeUserIds: nominees, evictedUserIds: [] },
    create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
  });

  // Put game into vote phase for the day
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_VOTE",
      stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
    },
  });
}
