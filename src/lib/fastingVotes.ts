import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

const NOM_PHASE_MS = 3 * 60 * 1000; // you can change later (3 min nominate feels good)
const VOTE_PHASE_MS = 2 * 60 * 1000; // eviction window (2 min)

export async function resolveFastingEviction(gameId: string) {
  // lock per-game so eviction can't run twice concurrently
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true, reason: "locked" as const };

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true },
    });
    if (!game) return { ok: false, error: "Game not found" as const };
    if (game.gameType !== "FASTING") return { ok: true, skipped: true, reason: "not_fasting" as const };
    if (game.state !== "ROUND_VOTE") return { ok: true, skipped: true, reason: "wrong_state" as const };

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
    });
    if (!rr) return { ok: false, error: "Missing roundResult" as const };

    // already resolved
    if (rr.evictedUserId) return { ok: true, skipped: true, reason: "already_evicted" as const };

    const nomineeA = rr.nomineeAUserId;
    const nomineeB = rr.nomineeBUserId;

    // Count votes
    const votes = await prisma.evictionVote.findMany({
      where: { gameId, roundNumber: game.roundNumber },
      select: { targetUserId: true },
    });

    const votesA = votes.filter((v) => v.targetUserId === nomineeA).length;
    const votesB = votes.filter((v) => v.targetUserId === nomineeB).length;

    // Tie-breaker: random (we can change later)
    const evictedUserId =
      votesA === votesB ? (Math.random() < 0.5 ? nomineeA : nomineeB) : votesA > votesB ? nomineeA : nomineeB;

    const systemUserId = await getSystemUserId();

    // Fetch usernames for system message
    const users = await prisma.user.findMany({
      where: { id: { in: [nomineeA, nomineeB, evictedUserId] } },
      select: { id: true, username: true },
    });
    const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;

    // Eliminate player + advance state
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // mark evicted in round result
      await tx.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { evictedUserId },
      });

      // mark player eliminated
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { status: "ELIMINATED", eliminatedAt: now },
      });

      // system message with readable names + vote totals
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] Eviction results:\n- ${nameOf(nomineeA)}: ${votesA}\n- ${nameOf(nomineeB)}: ${votesB}\n[SYSTEM] Evicted: ${nameOf(evictedUserId)}`,
        },
      });
    });

    // Count remaining active players
    const remaining = await prisma.gamePlayer.count({
      where: { gameId, status: "ACTIVE" },
    });

    // If 3 or fewer remain, finish game (simple v1: rank by povWins then activity)
    if (remaining <= 3) {
      await finishFastingGame(gameId);
      return { ok: true, finished: true as const };
    }

    // Start next round
    const nextRound = game.roundNumber + 1;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextRound,
        povUserId: null,
        roundStartedAt: now, // ✅ NEW round window starts here
        stateEndsAt: new Date(now.getTime() + NOM_PHASE_MS),
      },
    });

    // assign POV immediately so it’s never “blank”
    try {
      await assignFastingPov(gameId);
    } catch {}

    return { ok: true, advancedToRound: nextRound };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

async function finishFastingGame(gameId: string) {
  const now = new Date();

  const active = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { id: true, username: true } } },
  });

  // v1 ranking: POV wins desc, then plus-minus, then chatCount
  const ranked = [...active].sort((a, b) => {
    if (b.povWins !== a.povWins) return b.povWins - a.povWins;
    const aNet = a.plusCount - a.minusCount;
    const bNet = b.plusCount - b.minusCount;
    if (bNet !== aNet) return bNet - aNet;
    return b.chatCount - a.chatCount;
  });

  const placements = ranked.slice(0, 3).map((p, idx) => ({
    userId: p.userId,
    place: idx + 1,
    username: p.user.username,
  }));

  // everyone else gets eliminatedPlace assigned based on join order or elimination order already.
  // For v1, we just stamp top 3 and stamp remaining actives as 4th+.
  await prisma.$transaction(async (tx) => {
    // stamp placements for remaining actives
    for (let i = 0; i < ranked.length; i++) {
      const place = i + 1; // 1..remaining
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: { eliminatedPlace: place, status: "ELIMINATED", eliminatedAt: now },
      });
    }

    // finish game
    await tx.game.update({
      where: { id: gameId },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null, povUserId: null },
    });

    const systemUserId = await getSystemUserId();
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body:
          `[SYSTEM] Game finished!\n` +
          placements.map((p) => `- ${p.place}${p.place === 1 ? "st" : p.place === 2 ? "nd" : "rd"}: ${p.username}`).join("\n"),
      },
    });
  });

  // Rewards payout (your v1 values)
  const rewards = [
    { place: 1, karma: 12, t: 12 },
    { place: 2, karma: 5, t: 10 },
    { place: 3, karma: 3, t: 6 },
  ];

  for (const r of rewards) {
    const p = placements.find((x) => x.place === r.place);
    if (!p) continue;
    await prisma.user.update({
      where: { id: p.userId },
      data: { karma: { increment: r.karma }, tMoney: { increment: r.t } },
    });
  }
}
