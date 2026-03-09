/**
 * Resolve ROUND_VOTE for Casting (CASTING_BOT).
 * Day 1: no elimination (challenge runs; nominees from challenge start Day 2).
 * Day 2+: evict by vote; nominees from mini-game score.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getDayMsForGame } from "@/lib/castingDayLength";
import { finalizeCastingGame } from "@/lib/castingEngine";
import { resolveCastingNominations } from "./castingNoms";

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

function evictCount(activeCount: number) {
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

export async function resolveCastingEviction(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return { ok: true, skipped: true as const };
  if (game.state !== "ROUND_VOTE") return { ok: true, skipped: true as const };

  const dayNum = game.roundNumber ?? 1;
  const now = new Date();
  const sysId = await getSystemUserId();

  // Day 1: no algorithm eviction. Eliminations come from votes or health decay only.
  if (dayNum === 1) {
    await prisma.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber: 1 } },
      update: { evictedUserIds: [] },
      create: { gameId, dayNumber: 1, nomineeUserIds: [], evictedUserIds: [] },
    });
    await prisma.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day 1 complete.` },
    });

    const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    if (activeAfter <= 4) {
      await finalizeCastingGame(gameId);
      return { ok: true, finished: true as const };
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
    await resolveCastingNominations(gameId);
    return { ok: true, advancedToDay: 2 as const };
  }

  // Day 2+: evict by votes
  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
    select: { nomineeUserIds: true, evictedUserIds: true },
  });
  if (!day?.nomineeUserIds?.length) return { ok: true, skipped: true as const, reason: "no_nominees" as const };
  if (day.evictedUserIds?.length) return { ok: true, skipped: true as const, reason: "already_evicted" as const };

  const activeBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const ev = evictCount(activeBefore);
  if (ev === 0) {
    await finalizeCastingGame(gameId);
    return { ok: true, finished: true as const };
  }

  const nominees = day.nomineeUserIds;
  const votes = await prisma.castingVote.findMany({
    where: { gameId, dayNumber: dayNum },
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
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      data: { evictedUserIds: evicted },
    });
    await tx.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNum} resolved.` },
    });
  });

  const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (activeAfter <= 4) {
    await finalizeCastingGame(gameId);
    return { ok: true, finished: true as const };
  }

  const nextDay = dayNum + 1;
  const dayMs = await getDayMsForGame(gameId);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: nextDay,
      stateEndsAt: new Date(Date.now() + dayMs),
    },
  });
  await resolveCastingNominations(gameId);
  return { ok: true, advancedToDay: nextDay as number };
}
