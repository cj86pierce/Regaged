import { prisma } from "@/lib/prisma";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

// simple nominee score for now (minigame later)
// lower score => more likely nominated
function nomineeScore(p: { checks: number; health: number; keys: number }) {
  // checks matter most, then health, then keys
  return p.checks * 2 + p.health + p.keys * 3;
}

export async function startCastingDay(gameId: string, dayNumber: number) {
  // compute nominees (3 lowest) among ACTIVE
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, plusCount: true, minusCount: true, health: true, keys: true },
  });

  if (players.length < 4) return; // too small to nominate safely

  const ranked = players
    .map((p) => ({
      userId: p.userId,
      checks: (p.plusCount ?? 0) - (p.minusCount ?? 0),
      health: p.health ?? 70,
      keys: p.keys ?? 0,
    }))
    .sort((a, b) => nomineeScore(a) - nomineeScore(b));

  const [a, b, c] = ranked.slice(0, 3);
  if (!a || !b || !c) return;

  // create day record if missing
  await prisma.castingDayResult.upsert({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    update: { nomineeAUserId: a.userId, nomineeBUserId: b.userId, nomineeCUserId: c.userId },
    create: {
      gameId,
      dayNumber,
      nomineeAUserId: a.userId,
      nomineeBUserId: b.userId,
      nomineeCUserId: c.userId,
    },
  });

  // put game into voting state for the full day window
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_VOTE",
      stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
    },
  });
}
