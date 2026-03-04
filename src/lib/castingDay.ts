/**
 * Casting day logic per wiki:
 * - Day 1: No nominees. At end of 12h, expel 1 by algorithm (worst keys, checks, health).
 * - Day 2+: Nominees (2–4). 4 nominees → 2 expelled; 2–3 nominees → 1 expelled. Voting: 3, 2, 1 points.
 * - 12h per day. Final 4 = game over.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getCastingDayMs, getDayMsForGame } from "@/lib/castingDayLength";
import { finalizeCastingGame } from "@/lib/castingEngine";

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

/** Wiki: 4 nominees → 2 expelled; 2–3 nominees → 1 expelled. 6+ active → evict 2; 5 active → evict 1; ≤4 → final. */
function evictCount(activeCount: number) {
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

/** Wiki: 4 nominees when evict 2, 3 nominees when evict 1. */
function nomineeCount(ev: number) {
  if (ev === 2) return 4;
  if (ev === 1) return 3;
  return 0;
}

/** Wiki: keys = immunity (lowest keys nominated), then checks, then health. */
async function pickNominees(gameId: string, count: number): Promise<string[]> {
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
  });
  const ranked = rows
    .map((p) => ({
      userId: p.userId,
      keys: p.keys ?? 0,
      checks: netChecks(p.plusCount, p.minusCount),
      health: p.health ?? 70,
    }))
    .sort((a, b) => {
      if (a.keys !== b.keys) return a.keys - b.keys;
      if (a.checks !== b.checks) return a.checks - b.checks;
      return a.health - b.health;
    });
  return ranked.slice(0, count).map((x) => x.userId);
}

/** Wiki Day 1: No nominees. Expel 1 by algorithm (worst keys, checks, health). */
export async function resolveDay1(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return;
  if (game.state !== "ROUND_VOTE" || (game.roundNumber ?? 1) !== 1) return;

  const now = new Date();
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
  });
  const ranked = rows
    .map((p) => ({
      userId: p.userId,
      keys: p.keys ?? 0,
      checks: netChecks(p.plusCount, p.minusCount),
      health: p.health ?? 70,
    }))
    .sort((a, b) => {
      if (a.keys !== b.keys) return a.keys - b.keys;
      if (a.checks !== b.checks) return a.checks - b.checks;
      return a.health - b.health;
    });

  const evicted = ranked[0]?.userId;
  if (!evicted) return;

  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const place = activeCount;

  await prisma.$transaction(async (tx) => {
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: evicted } },
      data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: place },
    });
    await tx.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber: 1 } },
      update: { evictedUserIds: [evicted] },
      create: { gameId, dayNumber: 1, nomineeUserIds: [], evictedUserIds: [evicted] },
    });
    const sysId = await getSystemUserId();
    await tx.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day 1 resolved. One contestant eliminated by algorithm.` },
    });
  });

  const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (activeAfter <= 4) {
    await finalizeCastingGame(gameId);
    return;
  }

  const dayMs = await getDayMsForGame(gameId);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 2,
      stateEndsAt: new Date(Date.now() + dayMs),
    },
  });
  await ensureCastingVotingStarted(gameId, 2);
}

/**
 * Day 2+: Create nominees, switch to ROUND_VOTE with timer.
 */
export async function ensureCastingVotingStarted(gameId: string, dayNumber: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return;

  const dayMs = await getDayMsForGame(gameId);
  const active = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const ev = evictCount(active);
  const nomCount = nomineeCount(ev);

  if (nomCount === 0) {
    await finalizeCastingGame(gameId);
    return;
  }

  const existing = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeUserIds: true, evictedUserIds: true },
  });

  if (!existing?.nomineeUserIds?.length) {
    const nominees = await pickNominees(gameId, nomCount);
    await prisma.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber } },
      update: { nomineeUserIds: nominees, evictedUserIds: [] },
      create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
    });
    const sysId = await getSystemUserId();
    await prisma.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNumber}: Nominees selected.` },
    });
  }

  if (game.state !== "ROUND_VOTE") {
    await prisma.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + dayMs) },
    });
  } else {
    const g2 = await prisma.game.findUnique({ where: { id: gameId }, select: { stateEndsAt: true } });
    if (!g2?.stateEndsAt) {
      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + dayMs) },
      });
    }
  }
}

/**
 * Resolve day 2+ (ROUND_VOTE with nominees). Wiki: 3, 2, 1 points; most votes = expelled.
 */
export async function resolveCastingVoteDue(
  gameId: string,
  dayNumber: number,
  options?: { forceDue?: boolean }
) {
  const forceDue = options?.forceDue === true;
  const now = new Date();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, stateEndsAt: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return;
  if (game.state !== "ROUND_VOTE") return;

  const actualDay = game.roundNumber ?? dayNumber;
  if (actualDay <= 1) return; // day 1 uses resolveDay1

  const graceMs = forceDue ? 12 * 60 * 60 * 1000 : 20000;
  if (!forceDue && game.stateEndsAt && game.stateEndsAt.getTime() > now.getTime() + graceMs) return;

  await ensureCastingVotingStarted(gameId, actualDay);

  const activeBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const ev = evictCount(activeBefore);

  if (ev === 0) {
    await finalizeCastingGame(gameId);
    return;
  }

  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber: actualDay } },
    select: { nomineeUserIds: true, evictedUserIds: true },
  });
  if (!day || !day.nomineeUserIds?.length) {
    await advanceToNextDay(gameId, actualDay);
    return;
  }
  if (day.evictedUserIds?.length) {
    await advanceToNextDay(gameId, actualDay);
    return;
  }

  const nominees = day.nomineeUserIds;
  const votes = await prisma.castingVote.findMany({
    where: { gameId, dayNumber: actualDay },
    select: { targetUserId: true, points: true },
  });

  const totals = new Map<string, number>();
  for (const n of nominees) totals.set(n, 0);
  for (const v of votes) {
    if (totals.has(v.targetUserId)) {
      totals.set(v.targetUserId, (totals.get(v.targetUserId) ?? 0) + (v.points ?? 0));
    }
  }

  const rankedByPoints = nominees
    .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
    .sort((a, b) => b.pts - a.pts);

  const allZero = rankedByPoints.every((r) => r.pts === 0);
  let evicted: string[];

  if (allZero) {
    const nomineeRows = await prisma.gamePlayer.findMany({
      where: { gameId, userId: { in: nominees } },
      select: { userId: true, plusCount: true, minusCount: true, health: true },
    });
    const byChecks = nomineeRows
      .map((p) => ({ id: p.userId, checks: netChecks(p.plusCount, p.minusCount), health: p.health ?? 70 }))
      .sort((a, b) => a.checks - b.checks || a.health - b.health);
    evicted = byChecks.slice(0, ev).map((x) => x.id);
  } else {
    evicted = rankedByPoints.slice(0, ev).map((x) => x.id);
  }

  await prisma.$transaction(async (tx) => {
    for (const u of evicted) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: u } },
        data: { status: "ELIMINATED", eliminatedAt: now },
      });
      const remaining = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: u } },
        data: { eliminatedPlace: remaining + 1 },
      });
    }
    await tx.castingDayResult.update({
      where: { gameId_dayNumber: { gameId, dayNumber: actualDay } },
      data: { evictedUserIds: evicted },
    });
    const sysId = await getSystemUserId();
    await tx.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${actualDay} resolved.` },
    });
  });

  await advanceToNextDay(gameId, actualDay);
}

async function advanceToNextDay(gameId: string, dayNumber: number) {
  const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (activeAfter <= 4) {
    await finalizeCastingGame(gameId);
    return;
  }

  const nextDay = dayNumber + 1;
  const dayMs = await getDayMsForGame(gameId);

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: nextDay,
      stateEndsAt: new Date(Date.now() + dayMs),
    },
  });

  await ensureCastingVotingStarted(gameId, nextDay);
}
