import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getCastingDayMs, getDayMsForGame } from "@/lib/castingDayLength";
import { finalizeCastingGame } from "@/lib/castingEngine";

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

function evictCount(activeCount: number) {
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0; // final 4
}

function nomineeCountForEvict(ev: number) {
  if (ev === 2) return 4;
  if (ev === 1) return 3;
  return 0;
}

// keys immunity rule = choose nominees from lowest keys first; within same keys lowest checks
async function pickNominees(gameId: string, count: number) {
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

/**
 * Ensures a CastingDayResult exists for (gameId, dayNumber) with nomineeUserIds set.
 * Also switches game -> ROUND_VOTE and refreshes timer.
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
  const nomCount = nomineeCountForEvict(ev);

  if (nomCount === 0) {
    // Final 4: assign placements 1–4 and complete the game
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

    const systemUserId = await getSystemUserId();
    await prisma.gameMessage.create({
      data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Nominees selected.` },
    });
  }

  // Always ensure we’re in vote state with a valid timer
  if (game.state !== "ROUND_VOTE") {
    await prisma.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + dayMs) },
    });
  } else {
    // If already in vote but timer missing, set one
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
 * Resolve a due vote day (ROUND_VOTE with stateEndsAt <= now).
 * This function is **unstick-safe**: it will always advance the timer/day.
 */
export async function resolveCastingVoteDue(gameId: string, dayNumber: number) {
  const now = new Date();

  // Caller (cron catchUpCastingGame) already holds the per-game lock; no nested lock here
  // or we'd never acquire it and days would never advance.
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, stateEndsAt: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return;
  if (game.state !== "ROUND_VOTE") return;

  const dayMs = await getDayMsForGame(gameId);

    // If dayNumber mismatch, use actual
    const actualDay = game.roundNumber ?? dayNumber;

    // If not actually due yet, bail (20s grace for clock skew / cold starts)
    const graceMs = 20000;
    if (game.stateEndsAt && game.stateEndsAt.getTime() > now.getTime() + graceMs) return;

    // ✅ ALWAYS ensure nominees exist so resolution can proceed
    await ensureCastingVotingStarted(gameId, actualDay);

    const activeBefore = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    const ev = evictCount(activeBefore);

    // Final 4 reached: ensure placements 1–4 are set and game is COMPLETED
    if (ev === 0) {
      await finalizeCastingGame(gameId);
      return;
    }

    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: actualDay } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });
    if (!day || !day.nomineeUserIds?.length) {
      // Unstick: advance to next day instead of just resetting timer so we don't stay stuck on this day
      await advanceToNextDay(gameId, actualDay, dayMs);
      return;
    }

    // already resolved
    if (day.evictedUserIds?.length) {
      await advanceToNextDay(gameId, actualDay, dayMs);
      return;
    }

    const nominees = day.nomineeUserIds;

    // tally points
    const votes = await prisma.castingVote.findMany({
      where: { gameId, dayNumber: actualDay },
      select: { targetUserId: true, points: true },
    });

    const totals = new Map<string, number>();
    for (const n of nominees) totals.set(n, 0);
    for (const v of votes) {
      if (!totals.has(v.targetUserId)) continue;
      totals.set(v.targetUserId, (totals.get(v.targetUserId) ?? 0) + (v.points ?? 0));
    }

    const rankedByPoints = nominees
      .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

    // if nobody voted, fallback: evict lowest checks among nominees
    const allZero = rankedByPoints.every((r) => r.pts === 0);

    let evicted: string[] = [];

    if (!allZero) {
      evicted = rankedByPoints.slice(0, ev).map((x) => x.id);
    } else {
      const nomineeRows = await prisma.gamePlayer.findMany({
        where: { gameId, userId: { in: nominees } },
        select: { userId: true, plusCount: true, minusCount: true, health: true },
      });

      const byChecks = nomineeRows
        .map((p) => ({ id: p.userId, checks: netChecks(p.plusCount, p.minusCount), health: p.health ?? 70 }))
        .sort((a, b) => a.checks - b.checks || a.health - b.health);

      evicted = byChecks.slice(0, ev).map((x) => x.id);
    }

    await prisma.$transaction(async (tx) => {
      // eliminate evicted players & stamp place
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
        where: { gameId_dayNumber: { gameId, dayNumber: actualDay } },
        data: { evictedUserIds: evicted },
      });

      const systemUserId = await getSystemUserId();
      await tx.gameMessage.create({
        data: { gameId, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Day ${actualDay} resolved.` },
      });
    });

    // advance to next day no matter what
    await advanceToNextDay(gameId, actualDay, dayMs);
}

async function advanceToNextDay(gameId: string, dayNumber: number, dayMs?: number) {
  const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (activeAfter <= 4) {
    await finalizeCastingGame(gameId);
    return;
  }

  const nextDay = dayNumber + 1;
  const ms = dayMs ?? getCastingDayMs();

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: nextDay,
      stateEndsAt: new Date(Date.now() + ms),
    },
  });

  await ensureCastingVotingStarted(gameId, nextDay);
}
