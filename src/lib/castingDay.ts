import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

function netChecks(p: { plusCount: number | null; minusCount: number | null }) {
  return (p.plusCount ?? 0) - (p.minusCount ?? 0);
}

function computeEvictCount(activeCount: number) {
  // ensure final day = 4 players
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

function computeNomineeCount(evictCount: number) {
  if (evictCount === 2) return 4;
  if (evictCount === 1) return 3;
  return 0;
}

// keys immunity rule: choose from lowest keys first, then lowest checks
async function pickNominees(gameId: string, nomineeCount: number) {
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
  });

  const ranked = rows
    .map((p) => ({
      userId: p.userId,
      keys: p.keys ?? 0,
      checks: netChecks(p),
      health: p.health ?? 70,
    }))
    .sort((a, b) => {
      if (a.keys !== b.keys) return a.keys - b.keys;
      if (a.checks !== b.checks) return a.checks - b.checks;
      return a.health - b.health;
    });

  return ranked.slice(0, nomineeCount).map((x) => x.userId);
}

export async function ensureCastingVotingStarted(gameId: string, dayNumber: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true },
  });
  if (!game || game.gameType !== "CASTING") return;

  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const evictCount = computeEvictCount(activeCount);
  const nomineeCount = computeNomineeCount(evictCount);

  if (nomineeCount === 0) {
    // final 4 (or fewer) — nothing to nominate/vote
    return;
  }

  const existing = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeUserIds: true },
  });

  if (!existing?.nomineeUserIds?.length) {
    const nominees = await pickNominees(gameId, nomineeCount);

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
        body: `[SYSTEM] Voting has begun.`,
      },
    });
  }

  // ensure game is in voting phase with a timer
  if (game.state !== "ROUND_VOTE") {
    await prisma.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + CASTING_DAY_MS) },
    });
  }
}

export async function resolveCastingVoteDue(gameId: string, dayNumber: number) {
  const now = new Date();

  // lock per game to avoid double-resolve
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { gameType: true, state: true, roundNumber: true, stateEndsAt: true },
    });
    if (!game || game.gameType !== "CASTING") return;
    if (game.state !== "ROUND_VOTE") return;
    if ((game.roundNumber ?? 1) !== dayNumber) return;
    if (game.stateEndsAt && game.stateEndsAt.getTime() > now.getTime()) return;

    const activeCountBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    const evictCount = computeEvictCount(activeCountBefore);

    // Final 4 reached (or fewer)
    if (evictCount === 0) {
      await finalizeCasting(gameId);
      return;
    }

    // Make sure nominees exist (never get stuck)
    await ensureCastingVotingStarted(gameId, dayNumber);

    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });
    if (!day || !day.nomineeUserIds?.length) return;
    if (day.evictedUserIds?.length) return;

    const nominees = day.nomineeUserIds;

    // Tally votes (points)
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

    // If nobody voted, evict by worst checks among nominees (fallback so day never stalls)
    const fallbackChecks = await prisma.gamePlayer.findMany({
      where: { gameId, userId: { in: nominees } },
      select: { userId: true, plusCount: true, minusCount: true, keys: true, health: true },
    });

    const ranked = nominees
      .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

    const allZero = ranked.every((r) => r.pts === 0);

    let evicted: string[] = [];

    if (!allZero) {
      evicted = ranked.slice(0, evictCount).map((x) => x.id);
    } else {
      // fallback: lowest checks (keys immunity already handled by nomination selection)
      const byChecks = [...fallbackChecks]
        .map((p) => ({ id: p.userId, checks: netChecks(p), health: p.health ?? 70 }))
        .sort((a, b) => a.checks - b.checks || a.health - b.health);
      evicted = byChecks.slice(0, evictCount).map((x) => x.id);
    }

    await prisma.$transaction(async (tx) => {
      for (const u of evicted) {
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
      await tx.gameMessage.create({
        data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNumber} ended.` },
      });
    });

    const activeCountAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

    if (activeCountAfter <= 4) {
      await finalizeCasting(gameId);
      return;
    }

    // Advance to next day — ALWAYS sets stateEndsAt so timer never sticks at 0
    const nextDay = dayNumber + 1;
    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextDay,
        stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
      },
    });

    // Immediately start voting for new day (your design)
    await ensureCastingVotingStarted(gameId, nextDay);
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

async function finalizeCasting(gameId: string) {
  const now = new Date();
  const systemUserId = await getSystemUserId();

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
  });

  const ranked = [...actives].sort((a, b) => {
    const ah = a.health ?? 70, bh = b.health ?? 70;
    if (bh !== ah) return bh - ah;
    const ak = a.keys ?? 0, bk = b.keys ?? 0;
    if (bk !== ak) return bk - ak;
    const ac = netChecks(a), bc = netChecks(b);
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

    await tx.gameMessage.create({
      data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Castings finished.` },
    });
  });
}
