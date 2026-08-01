/**
 * Castings day change - runs when dayEndsAt (stateEndsAt) is reached.
 * Server-only; does not depend on players loading the page.
 *
 * Sequence: 1) Determine nominees 2) Resolve votes 3) Health decay 4) Announce 5) Next day
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getCastingDayMs } from "@/lib/castingDayLength";
import { finalizeCastingGame } from "@/lib/castingEngine";

const HOUR_MS = 60 * 60 * 1000;

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

/** Decay by inactivity: <1h no decay; 12-24h=-5; 24-36h=-15; 36-48h=-35; 48h+=-35-30 per day */
function healthDecayForInactivity(lastActiveAt: Date, now: Date): number {
  const ms = now.getTime() - lastActiveAt.getTime();
  const hours = ms / HOUR_MS;
  if (hours < 1) return 0;
  if (hours < 12) return 0;
  if (hours < 24) return 5;
  if (hours < 36) return 5 + 10;
  if (hours < 48) return 5 + 10 + 20;
  const daysOver48 = Math.floor((hours - 48) / 24);
  return 35 + 30 * daysOver48;
}

/** Pick 3 nominees: lowest mini game scores; ties: checks asc, then random */
function pickNominees(
  rows: {
    userId: string;
    castingDayMiniGameScore: number;
    plusCount: number;
    minusCount: number;
  }[]
): string[] {
  const withChecks = rows.map((r) => ({
    ...r,
    checks: netChecks(r.plusCount, r.minusCount),
    rnd: Math.random(),
  }));
  const sorted = [...withChecks].sort((a, b) => {
    if (a.castingDayMiniGameScore !== b.castingDayMiniGameScore)
      return a.castingDayMiniGameScore - b.castingDayMiniGameScore;
    if (a.checks !== b.checks) return a.checks - b.checks;
    return a.rnd - b.rnd;
  });
  return sorted.slice(0, 3).map((x) => x.userId);
}

export async function runCastingsDayChangeIfDue(gameId: string): Promise<
  | { ok: true; advanced?: boolean; finished?: boolean }
  | { ok: false; skipped: true; reason: string }
> {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: false, skipped: true, reason: "locked" };

  try {
    const now = new Date();
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameType: true,
        state: true,
        roundNumber: true,
        stateEndsAt: true,
        castingDayProcessedAt: true,
      },
    });

    if (!game || game.gameType !== "CASTING") return { ok: false, skipped: true, reason: "not_casting" };
    if (game.state !== "ROUND_VOTE") return { ok: false, skipped: true, reason: "wrong_state" };

    const dayEndsAt = game.stateEndsAt;
    if (!dayEndsAt || now.getTime() < dayEndsAt.getTime()) {
      return { ok: false, skipped: true, reason: "not_due" };
    }

    // Prevent double execution: only process if we haven't already processed this day end
    if (game.castingDayProcessedAt && game.castingDayProcessedAt.getTime() >= dayEndsAt.getTime()) {
      return { ok: false, skipped: true, reason: "already_processed" };
    }

    const dayNum = game.roundNumber ?? 1;
    const sysId = await getSystemUserId();
    const dayMs = getCastingDayMs();

    // Mark as processing to prevent double-run
    await prisma.game.update({
      where: { id: gameId },
      data: { castingDayProcessedAt: now },
    });

    const activeBefore = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      select: {
        userId: true,
        health: true,
        lastActiveAt: true,
        castingDayMiniGameScore: true,
        plusCount: true,
        minusCount: true,
      },
    });

    if (activeBefore.length <= 4) {
      await finalizeCastingGame(gameId);
      return { ok: true, finished: true };
    }

    // 1) Determine nominees (3 lowest mini game scores)
    const nominees = pickNominees(
      activeBefore.map((p) => ({
        userId: p.userId,
        castingDayMiniGameScore: p.castingDayMiniGameScore ?? 0,
        plusCount: p.plusCount ?? 0,
        minusCount: p.minusCount ?? 0,
      }))
    );

    await prisma.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      update: { nomineeUserIds: nominees, evictedUserIds: [] },
      create: { gameId, dayNumber: dayNum, nomineeUserIds: nominees, evictedUserIds: [] },
    });

    // 2) Resolve votes - most votes = eliminated
    const votes = await prisma.castingVote.findMany({
      where: { gameId, dayNumber: dayNum },
      select: { targetUserId: true, points: true },
    });
    const totals = new Map<string, number>();
    for (const n of nominees) totals.set(n, 0);
    for (const v of votes) {
      if (totals.has(v.targetUserId))
        totals.set(v.targetUserId, (totals.get(v.targetUserId) ?? 0) + (v.points ?? 0));
    }
    const rankedByVotes = nominees
      .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    const votedOut = rankedByVotes[0]?.id;

    const votedOutUsernames = await prisma.user.findMany({
      where: { id: { in: votedOut ? [votedOut] : [] } },
      select: { id: true, username: true },
    });
    const votedOutName = votedOutUsernames.find((u) => u.id === votedOut)?.username ?? "Someone";

    // 3) Eliminate voted player
    const evictedUserIds: string[] = [];
    if (votedOut) {
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: votedOut } },
        data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: activeBefore.length },
      });
      evictedUserIds.push(votedOut);
      await prisma.castingDayResult.update({
        where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
        data: { evictedUserIds },
      });
    }

    // 4) Apply health decay
    const decayDeaths: string[] = [];
    let place = activeBefore.length; // voted-out already took this place
    for (const p of activeBefore) {
      if (p.userId === votedOut) continue;
      const damage = healthDecayForInactivity(p.lastActiveAt ?? now, now);
      if (damage <= 0) continue;
      const hp = (p.health ?? 70) - damage;
      const newHp = Math.max(0, hp);
      const eliminated = newHp <= 0;
      if (eliminated) {
        place--;
        decayDeaths.push(p.userId);
      }
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: p.userId } },
        data: {
          health: newHp,
          ...(eliminated
            ? { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: place }
            : {}),
        },
      });
    }

    const decayUsernames = await prisma.user.findMany({
      where: { id: { in: decayDeaths } },
      select: { id: true, username: true },
    });
    const nameOf = (id: string) => decayUsernames.find((u) => u.id === id)?.username ?? id;

    // 5) Announce deaths
    const lines: string[] = [];
    if (votedOut) lines.push(`${votedOutName} has been voted out.`);
    for (const id of decayDeaths) lines.push(`${nameOf(id)} has died from inactivity.`);
    if (lines.length) {
      await prisma.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] ${lines.join("\n")}` },
      });
    }

    const activeAfter = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    if (activeAfter <= 4) {
      await finalizeCastingGame(gameId);
      return { ok: true, finished: true };
    }

    // 6) Start next day
    const nextDay = dayNum + 1;
    const nextEnd = new Date(now.getTime() + dayMs);
    await prisma.$transaction([
      prisma.game.update({
        where: { id: gameId },
        data: {
          roundNumber: nextDay,
          castingDayStartedAt: now,
          stateEndsAt: nextEnd,
          castingDayProcessedAt: null,
        },
      }),
      prisma.gamePlayer.updateMany({
        where: { gameId, status: "ACTIVE" },
        data: { castingDayMiniGameScore: 0 },
      }),
    ]);

    return { ok: true, advanced: true };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
