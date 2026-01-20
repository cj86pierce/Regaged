import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

// CASTING SLOW payouts (Karma = “K”)
const CASTING_SLOW_PAYOUT: Record<number, { karma: number; tMoney: number }> = {
  1: { karma: 80000, tMoney: 50 },
  2: { karma: 40000, tMoney: 25 },
  3: { karma: 20000, tMoney: 15 },
  4: { karma: 10000, tMoney: 12 },
  5: { karma: 8000, tMoney: 10 },
  6: { karma: 6000, tMoney: 8 },
  7: { karma: 5000, tMoney: 7 },
  8: { karma: 4000, tMoney: 6 },
  9: { karma: 3000, tMoney: 5 },
  10: { karma: 2000, tMoney: 4 },
  11: { karma: 1000, tMoney: 3 },
  12: { karma: 0, tMoney: 2 },
  13: { karma: 0, tMoney: 2 },
  // 14–20: 0/0
};

function checks(plus: number, minus: number) {
  return (plus ?? 0) - (minus ?? 0);
}

// Nominee logic:
// “4 lowest checks, but keys give immunity if someone has lower keys”
// Implementation: choose nominees from lowest-key players first, then by checks ascending.
async function pickNominees(gameId: string, nomineeCount: number) {
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

  // Sort by keys asc (most vulnerable), then checks asc, then health asc
  list.sort((a, b) => {
    if (a.keys !== b.keys) return a.keys - b.keys;
    if (a.checks !== b.checks) return a.checks - b.checks;
    return a.health - b.health;
  });

  return list.slice(0, nomineeCount).map((x) => x.userId);
}

// Evict count ensures final day reaches exactly 4 players
function computeEvictCount(activeCount: number) {
  // if 6+ players -> evict 2
  // if 5 players -> evict 1 (so next day = final 4)
  // if 4 players -> evict 0
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

function nomineeCountForEvict(evictCount: number) {
  // if evict 2 -> 4 nominees; if evict 1 -> 3 nominees
  if (evictCount === 2) return 4;
  if (evictCount === 1) return 3;
  return 0;
}

export async function startCastingDay(gameId: string, dayNumber: number) {
  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const evictCount = computeEvictCount(activeCount);

  if (evictCount === 0) return; // final scoring will handle

  const nominees = await pickNominees(gameId, nomineeCountForEvict(evictCount));
  if (nominees.length === 0) return;

  await prisma.castingDayResult.upsert({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    update: { nomineeUserIds: nominees, evictedUserIds: [] },
    create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
  });

  // stay in ROUND_VOTE for the full day
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_VOTE",
      stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
    },
  });

  // Optional system message (no “who has keys” reveal)
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

export async function resolveCastingDay(gameId: string, dayNumber: number) {
  // per-game lock to prevent double resolve
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const };

  try {
    const now = new Date();

    const activeCountBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    const evictCount = computeEvictCount(activeCountBefore);

    if (evictCount === 0) {
      await finalizeCastingGame(gameId);
      return { ok: true, finalized: true as const };
    }

    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });
    if (!day) return { ok: false, error: "No day record" as const };
    if (day.evictedUserIds?.length) return { ok: true, skipped: true as const };

    const nominees = day.nomineeUserIds;

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

    // sort nominees by total points desc (most voted = out)
    const ranked = nominees
      .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

    const evicted = ranked.slice(0, evictCount).map((x) => x.id);

    // eliminate and stamp placement out of 20
    await prisma.$transaction(async (tx) => {
      for (const u of evicted) {
        // mark eliminated
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: u } },
          data: { status: "ELIMINATED", eliminatedAt: now },
        });

        const remaining = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        const place = remaining + 1; // out of 20 logic
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
      const names = await tx.user.findMany({
        where: { id: { in: nominees } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => names.find((x) => x.id === id)?.username ?? id;

      const lines = ranked
        .map((r) => `- ${nameOf(r.id)}: ${r.pts}${evicted.includes(r.id) ? " (OUT)" : ""}`)
        .join("\n");

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] Vote totals:\n${lines}`,
        },
      });
    });

    // advance to next day or finalize
    const activeCountAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

    if (activeCountAfter <= 4) {
      await finalizeCastingGame(gameId);
      return { ok: true, finalized: true as const };
    }

    const nextDay = dayNumber + 1;
    const end = new Date(Date.now() + CASTING_DAY_MS);

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE", // placeholder “day running”
        roundNumber: nextDay,
        stateEndsAt: end,
      },
    });

    // create nominees for next day immediately
    await startCastingDay(gameId, nextDay);

    return { ok: true, advancedToDay: nextDay };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

export async function finalizeCastingGame(gameId: string) {
  const now = new Date();
  const systemUserId = await getSystemUserId();

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
  });

  // rank by: health desc, keys desc, checks desc
  const ranked = [...actives].sort((a, b) => {
    const ah = a.health ?? 70, bh = b.health ?? 70;
    if (bh !== ah) return bh - ah;

    const ak = a.keys ?? 0, bk = b.keys ?? 0;
    if (bk !== ak) return bk - ak;

    const ac = checks(a.plusCount ?? 0, a.minusCount ?? 0);
    const bc = checks(b.plusCount ?? 0, b.minusCount ?? 0);
    return bc - ac;
  });

  await prisma.$transaction(async (tx) => {
    // stamp 1..4 and eliminate them (game completed)
    for (let i = 0; i < ranked.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: i + 1,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
    });

    const users = await tx.user.findMany({
      where: { id: { in: ranked.map((r) => r.userId) } },
      select: { id: true, username: true },
    });
    const nameOf = (id: string) => users.find((x) => x.id === id)?.username ?? id;

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body:
          `[SYSTEM] Castings finished!\n` +
          `- 1st: ${nameOf(ranked[0]?.userId ?? "?")}\n` +
          `- 2nd: ${nameOf(ranked[1]?.userId ?? "?")}\n` +
          `- 3rd: ${nameOf(ranked[2]?.userId ?? "?")}\n` +
          `- 4th: ${nameOf(ranked[3]?.userId ?? "?")}`,
      },
    });
  });

  // payouts for places 1..13 only
  const placements = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: { userId: true, eliminatedPlace: true },
  });

  for (const p of placements) {
    const place = p.eliminatedPlace ?? 999;
    const pay = CASTING_SLOW_PAYOUT[place];
    if (!pay) continue;

    await prisma.user.update({
      where: { id: p.userId },
      data: {
        karma: { increment: pay.karma },
        tMoney: { increment: pay.tMoney },
      },
    });
  }
}
