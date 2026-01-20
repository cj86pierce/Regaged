import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

const PAY: Record<number, { karma: number; t: number }> = {
  1: { karma: 80, t: 50 },
  2: { karma: 40, t: 25 },
  3: { karma: 20, t: 15 },
  4: { karma: 10, t: 12 },
  5: { karma: 8, t: 10 },
  6: { karma: 6, t: 8 },
  7: { karma: 5, t: 7 },
  8: { karma: 4, t: 6 },
  9: { karma: 3, t: 5 },
  10: { karma: 2, t: 4 },
  11: { karma: 1, t: 3 },
  12: { karma: 0, t: 2 },
  13: { karma: 0, t: 2 },
};

function netChecks(plus: number, minus: number) {
  return (plus ?? 0) - (minus ?? 0);
}

function evictCount(activeCount: number) {
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

function nomineeCount(evictCnt: number) {
  if (evictCnt === 2) return 4;
  if (evictCnt === 1) return 3;
  return 0;
}

// keys immunity: choose nominees from lowest keys first, then lowest checks
async function pickNominees(gameId: string, count: number) {
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
  });

  const list = rows.map((p) => ({
    userId: p.userId,
    keys: p.keys ?? 0,
    checks: netChecks(p.plusCount ?? 0, p.minusCount ?? 0),
    health: p.health ?? 70,
  }));

  list.sort((a, b) => {
    if (a.keys !== b.keys) return a.keys - b.keys;
    if (a.checks !== b.checks) return a.checks - b.checks;
    return a.health - b.health;
  });

  return list.slice(0, count).map((x) => x.userId);
}

export async function startCastingDay(gameId: string, dayNumber: number) {
  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!g || g.gameType !== "CASTING") return;

  const active = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const eCnt = evictCount(active);
  const nCnt = nomineeCount(eCnt);
  if (nCnt === 0) return; // final 4 or fewer

  const existing = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeUserIds: true },
  });

  if (existing?.nomineeUserIds?.length) {
    if (g.state !== "ROUND_VOTE") {
      await prisma.game.update({
        where: { id: gameId },
        data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + CASTING_DAY_MS) },
      });
    }
    return;
  }

  const nominees = await pickNominees(gameId, nCnt);

  await prisma.castingDayResult.upsert({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    update: { nomineeUserIds: nominees, evictedUserIds: [] },
    create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + CASTING_DAY_MS) },
  });

  const systemUserId = await getSystemUserId();
  await prisma.gameMessage.create({
    data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Voting has begun.` },
  });
}

export async function resolveCastingDayIfDue(gameId: string, dayNumber: number) {
  const now = new Date();

  // lock per game
  const lock = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lock?.[0]?.locked) return;

  try {
    const g = await prisma.game.findUnique({
      where: { id: gameId },
      select: { gameType: true, state: true, roundNumber: true },
    });
    if (!g || g.gameType !== "CASTING") return;
    if (g.state !== "ROUND_VOTE") return;
    if ((g.roundNumber ?? 1) !== dayNumber) return;

    const activeBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    const eCnt = evictCount(activeBefore);

    if (eCnt === 0) {
      await finalizeCasting(gameId);
      return;
    }

    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });
    if (!day || !day.nomineeUserIds?.length) return;
    if (day.evictedUserIds?.length) return;

    const nominees = day.nomineeUserIds;

    // Get nominee health so we can “day-change kill” nominees at 0 HP (even if not voted out)
    const nomineePlayers = await prisma.gamePlayer.findMany({
      where: { gameId, userId: { in: nominees }, status: "ACTIVE" },
      select: { userId: true, health: true },
    });

    const zeroHpNominees = nomineePlayers
      .filter((p) => (p.health ?? 70) <= 0)
      .map((p) => p.userId);

    // tally votes
    const votes = await prisma.castingVote.findMany({
      where: { gameId, dayNumber },
      select: { targetUserId: true, points: true },
    });

    const totals = new Map<string, number>();
    for (const n of nominees) totals.set(n, 0);
    for (const v of votes) {
      if (!totals.has(v.targetUserId)) continue;
      totals.set(v.targetUserId, (totals.get(v.targetUserId) ?? 0) + (v.points ?? 0));
    }

    const rankedByVotes = nominees
      .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

    const evictedByVotes = rankedByVotes.slice(0, eCnt).map((x) => x.id);

    // Final evictions this day:
    // - always evict top vote getters
    // - PLUS any nominees sitting at 0 HP (even if “saved” by votes)
    const evictedSet = new Set<string>();
    for (const id of evictedByVotes) evictedSet.add(id);
    for (const id of zeroHpNominees) evictedSet.add(id);

    const evicted = Array.from(evictedSet);

    await prisma.$transaction(async (tx) => {
      // stamp eliminations one-by-one so places are unique
      for (const u of evicted) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: u } },
          data: { status: "ELIMINATED", eliminatedAt: now },
        });

        const remaining = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        const place = remaining + 1;
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: u } },
          data: { eliminatedPlace: place },
        });
      }

      await tx.castingDayResult.update({
        where: { gameId_dayNumber: { gameId, dayNumber } },
        data: { evictedUserIds: evicted },
      });

      const systemUserId = await getSystemUserId();
      await tx.gameMessage.create({
        data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Voting ended.` },
      });
    });

    const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    if (activeAfter <= 4) {
      await finalizeCasting(gameId);
      return;
    }

    // advance to next day (ROUND_NOMINATE placeholder) and immediately start voting
    const nextDay = dayNumber + 1;
    await prisma.game.update({
      where: { id: gameId },
      data: { state: "ROUND_NOMINATE", roundNumber: nextDay, stateEndsAt: new Date(Date.now() + CASTING_DAY_MS) },
    });

    await startCastingDay(gameId, nextDay);
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

async function finalizeCasting(gameId: string) {
  const now = new Date();

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
  });

  const ranked = [...actives].sort((a, b) => {
    const ah = a.health ?? 70, bh = b.health ?? 70;
    if (bh !== ah) return bh - ah;

    const ak = a.keys ?? 0, bk = b.keys ?? 0;
    if (bk !== ak) return bk - ak;

    const ac = netChecks(a.plusCount ?? 0, a.minusCount ?? 0);
    const bc = netChecks(b.plusCount ?? 0, b.minusCount ?? 0);
    return bc - ac;
  });

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ranked.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: i + 1 },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
    });
  });

  // payouts 1..13
  const players = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: { userId: true, eliminatedPlace: true },
  });

  for (const p of players) {
    const place = p.eliminatedPlace ?? 999;
    const pay = PAY[place];
    if (!pay) continue;

    await prisma.user.update({
      where: { id: p.userId },
      data: {
        karma: { increment: pay.karma },
        tMoney: { increment: pay.t },
      },
    });
  }
}
