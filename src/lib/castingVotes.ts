/**
 * Resolve ROUND_VOTE for Casting (CASTING / CASTING_BOT).
 *
 * Day 1: competition/activity only — no algorithmic eviction.
 * Day 2+: evict the nominee with the highest vote points (1 per day).
 * When ≤5 remain, finalize by keys, then challenge score, then activity.
 *
 * After eviction, advance into the next day's ROUND_NOMINATE window and do NOT
 * immediately pick nominees — that would skip the voting window for the next day.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getDayMsForGame } from "@/lib/castingDayLength";
import { finalizeCastingGame } from "@/lib/castingEngine";
import { castingNomineeCount } from "./castingNoms";

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

async function startNextNominateDay(gameId: string, nextDay: number) {
  const dayMs = await getDayMsForGame(gameId);
  await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextDay,
        stateEndsAt: new Date(Date.now() + dayMs),
      },
    }),
    // Fresh challenge scores for the new day
    prisma.gamePlayer.updateMany({
      where: { gameId, status: "ACTIVE" },
      data: { castingDayMiniGameScore: 0 },
    }),
  ]);
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

  // Day 1: no algorithm eviction
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
    if (activeAfter <= 5) {
      await finalizeCastingGame(gameId);
      return { ok: true, finished: true as const };
    }

    await startNextNominateDay(gameId, 2);
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
  if (castingNomineeCount(activeBefore) === 0) {
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
  let evicted: string;

  if (allZero) {
    // Fallback: fewest keys, then fewest checks, then lowest health
    const nomineeRows = await prisma.gamePlayer.findMany({
      where: { gameId, userId: { in: nominees } },
      select: { userId: true, plusCount: true, minusCount: true, health: true, keys: true },
    });
    const byChecks = nomineeRows
      .map((p) => ({
        id: p.userId,
        keys: p.keys ?? 0,
        checks: netChecks(p.plusCount, p.minusCount),
        health: p.health ?? 70,
      }))
      .sort((a, b) => a.keys - b.keys || a.checks - b.checks || a.health - b.health);
    evicted = byChecks[0]!.id;
  } else {
    // Tie: random among tied for highest points
    const topPts = rankedByPoints[0]!.pts;
    const tied = rankedByPoints.filter((r) => r.pts === topPts);
    evicted = tied[Math.floor(Math.random() * tied.length)]!.id;
  }

  const evictedUser = await prisma.user.findUnique({
    where: { id: evicted },
    select: { username: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: evicted } },
      data: { status: "ELIMINATED", eliminatedAt: now },
    });
    const remaining = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: evicted } },
      data: { eliminatedPlace: remaining + 1 },
    });
    await tx.castingDayResult.update({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      data: { evictedUserIds: [evicted] },
    });
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: sysId,
        channel: "PUBLIC",
        body: `[SYSTEM] ${evictedUser?.username ?? evicted} has been voted out.\nDay ${dayNum} resolved.`,
      },
    });
  });

  const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  // FAQ: final day when 5 players remain
  if (activeAfter <= 5) {
    await finalizeCastingGame(gameId);
    return { ok: true, finished: true as const };
  }

  const nextDay = dayNum + 1;
  await startNextNominateDay(gameId, nextDay);
  return { ok: true, advancedToDay: nextDay as number };
}
