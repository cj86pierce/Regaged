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

    const result = await prisma.$transaction(async (tx) => {
      await tx.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { evictedUserId },
      });

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { status: "ELIMINATED", eliminatedAt: now },
      });

      const remainingActive = await tx.gamePlayer.count({
        where: { gameId, status: "ACTIVE" },
      });

      const place = remainingActive + 1;

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { eliminatedPlace: place },
      });

      // get usernames
      const users = await tx.user.findMany({
        where: { id: { in: [nomineeA, nomineeB, evictedUserId] } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;

      const lines = [
        `${nameOf(nomineeA)}|${votesA}|${evictedUserId === nomineeA ? "OUT" : ""}`,
        `${nameOf(nomineeB)}|${votesB}|${evictedUserId === nomineeB ? "OUT" : ""}`,
      ];

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM:EVICT_VOTES]\n${lines.join("\n")}`,
        },
      });

      return { remainingActive };
    });

    if (result.remainingActive <= 3) {
      await finishFastingGame(gameId);
      return { ok: true, finished: true as const };
    }

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

  const ranked = [...actives].sort((a, b) => {
    if (b.povWins !== a.povWins) return b.povWins - a.povWins;
    const aNet = a.plusCount - a.minusCount;
    const bNet = b.plusCount - b.minusCount;
    if (bNet !== aNet) return bNet - aNet;
    return b.chatCount - a.chatCount;
  });

  const winners = ranked.slice(0, 3);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ranked.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: {
          eliminatedPlace: i + 1,
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
          `[SYSTEM] Game finished! - 1st: ${winners[0]?.user.username ?? "?"} - 2nd: ${winners[1]?.user.username ?? "?"} - 3rd: ${winners[2]?.user.username ?? "?"}`,
      },
    });
  });

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
