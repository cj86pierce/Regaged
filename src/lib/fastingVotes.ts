import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

const NOM_PHASE_MS = 3 * 60 * 1000;

export async function resolveFastingEviction(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const };

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true },
    });
    if (!game || game.gameType !== "FASTING" || game.state !== "ROUND_VOTE") return { ok: true, skipped: true as const };

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
    });
    if (!rr || rr.evictedUserId) return { ok: true, skipped: true as const };

    const nomineeA = rr.nomineeAUserId;
    const nomineeB = rr.nomineeBUserId;

    const votes = await prisma.evictionVote.findMany({
      where: { gameId, roundNumber: game.roundNumber },
      select: { targetUserId: true },
    });

    const votesA = votes.filter((v) => v.targetUserId === nomineeA).length;
    const votesB = votes.filter((v) => v.targetUserId === nomineeB).length;

    const evictedUserId =
      votesA === votesB ? (Math.random() < 0.5 ? nomineeA : nomineeB) : votesA > votesB ? nomineeA : nomineeB;

    const systemUserId = await getSystemUserId();
    const now = new Date();

    // eliminate + stamp place
    const result = await prisma.$transaction(async (tx) => {
      await tx.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { evictedUserId },
      });

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { status: "ELIMINATED", eliminatedAt: now },
      });

      // count remaining after elimination
      const remainingActive = await tx.gamePlayer.count({
        where: { gameId, status: "ACTIVE" },
      });

      // if 14 remain → evicted is 15th, if 3 remain → evicted is 4th, etc.
      const place = remainingActive + 1;

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { eliminatedPlace: place },
      });

      const users = await tx.user.findMany({
        where: { id: { in: [nomineeA, nomineeB, evictedUserId] } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body:
            `[SYSTEM] Eviction results:\n` +
            `- ${nameOf(nomineeA)}: ${votesA}\n` +
            `- ${nameOf(nomineeB)}: ${votesB}\n` +
            `[SYSTEM] Evicted: ${nameOf(evictedUserId)}`,
        },
      });

      return { remainingActive };
    });

    if (result.remainingActive <= 3) {
      await finishFastingGame(gameId);
      return { ok: true, finished: true as const };
    }

    // next round
    const nextRound = game.roundNumber + 1;
    const now2 = new Date();

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextRound,
        povUserId: null,
        roundStartedAt: now2,
        stateEndsAt: new Date(now2.getTime() + NOM_PHASE_MS),
      },
    });

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
  const systemUserId = await getSystemUserId();

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { id: true, username: true } } },
  });

  // Rank remaining by povWins -> net reactions -> chatCount
  const ranked = [...actives].sort((a, b) => {
    if (b.povWins !== a.povWins) return b.povWins - a.povWins;
    const aNet = a.plusCount - a.minusCount;
    const bNet = b.plusCount - b.minusCount;
    if (bNet !== aNet) return bNet - aNet;
    return b.chatCount - a.chatCount;
  });

  const winners = ranked.slice(0, 3);

  await prisma.$transaction(async (tx) => {
    // stamp 1st/2nd/3rd for remaining active players
    for (let i = 0; i < ranked.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: {
          eliminatedPlace: i + 1,      // 1..3 (and maybe 1..N if you ever finish early)
          status: "ELIMINATED",
          eliminatedAt: now,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null, povUserId: null },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body:
          `[SYSTEM] Game finished!\n` +
          `- 1st: ${winners[0]?.user.username ?? "?"}\n` +
          `- 2nd: ${winners[1]?.user.username ?? "?"}\n` +
          `- 3rd: ${winners[2]?.user.username ?? "?"}`,
      },
    });
  });

  // payout (your values)
  const payout = [
    { idx: 0, karma: 12, t: 12 },
    { idx: 1, karma: 5, t: 10 },
    { idx: 2, karma: 3, t: 6 },
  ];

  for (const p of payout) {
    const u = winners[p.idx];
    if (!u) continue;
    await prisma.user.update({
      where: { id: u.userId },
      data: { karma: { increment: p.karma }, tMoney: { increment: p.t } },
    });
  }
}
