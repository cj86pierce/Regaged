import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";

const NOM_PHASE_MS = 3 * 60 * 1000;
const BOT_ROUND_MS = 2 * 60 * 1000; // 2 min for testing

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
    if (!game || (game.gameType !== "FASTING" && game.gameType !== "FASTING_BOT" && game.gameType !== "FROOKIES" && game.gameType !== "ROOKIES" && game.gameType !== "FROOKIES_BOT" && game.gameType !== "ROOKIES_BOT") || game.state !== "ROUND_VOTE") return { ok: true, skipped: true as const };

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
      await finishFastingGame(gameId, game.gameType);
      return { ok: true, finished: true as const };
    }

    const nextRound = game.roundNumber + 1;
    const now2 = new Date();
    const nomMs = (game.gameType === "FASTING_BOT" || game.gameType === "FROOKIES_BOT" || game.gameType === "ROOKIES_BOT") ? BOT_ROUND_MS : NOM_PHASE_MS;
    const isFrookies = game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT";

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextRound,
        povUserId: null,
        roundStartedAt: now2,
        stateEndsAt: new Date(now2.getTime() + nomMs),
        ...(isFrookies ? { hohUserId: null, povSavedUserId: null, frookiesPhase: null } : {}),
      },
    });

    if (isFrookies) {
      await prisma.gamePlayer.updateMany({
        where: { gameId, status: "ACTIVE" },
        data: { castingDayMiniGameScore: 0 },
      });
      try {
        await assignFrookiesHoh(gameId, { skipLock: true });
      } catch {}
    } else {
      try {
        await assignFastingPov(gameId);
      } catch {}
    }

    return { ok: true, advancedToRound: nextRound };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

export async function finishFastingGame(gameId: string, gameType?: string) {
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
  const top6 = ranked.slice(0, 6);
  const top10 = ranked.slice(0, 10);

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
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null, povUserId: null, hohUserId: null },
    });

    const isFrookiesMsg = gameType === "FROOKIES";
    const isRookiesMsg = gameType === "ROOKIES";
    const placementMsg = isRookiesMsg && top10.length > 0
      ? `1st: ${top10[0]?.user.username ?? "?"} (80 Karma + 50 T$) - 2nd: ${top10[1]?.user.username ?? "?"} - 3rd: ${top10[2]?.user.username ?? "?"} - 4th: ${top10[3]?.user.username ?? "?"} - 5th: ${top10[4]?.user.username ?? "?"} - 6th–10th: ${top10.slice(5).map((u) => u?.user.username ?? "?").join(", ")}`
      : isFrookiesMsg && top6.length > 0
        ? `1st: ${top6[0]?.user.username ?? "?"} (25 Karma + 60 T$) - 2nd: ${top6[1]?.user.username ?? "?"} (3 Karma + 20 T$) - 3rd: ${top6[2]?.user.username ?? "?"} - 4th: ${top6[3]?.user.username ?? "?"} - 5th: ${top6[4]?.user.username ?? "?"} - 6th: ${top6[5]?.user.username ?? "?"}`
        : `1st: ${winners[0]?.user.username ?? "?"} - 2nd: ${winners[1]?.user.username ?? "?"} - 3rd: ${winners[2]?.user.username ?? "?"}`;
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Game finished! - ${placementMsg}`,
      },
    });
  });

  // Block payouts for bot games
  const isBotGame = gameType === "FASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT";
  if (!isBotGame) {
    const isFrookies = gameType === "FROOKIES";
    const isRookies = gameType === "ROOKIES";
    const payout = isFrookies
      ? [
          { idx: 0, karma: 25, t: 60 },
          { idx: 1, karma: 3, t: 20 },
          { idx: 2, karma: 0, t: 10 },
          { idx: 3, karma: 0, t: 10 },
          { idx: 4, karma: 0, t: 10 },
          { idx: 5, karma: 0, t: 10 },
        ]
      : isRookies
        ? [
            { idx: 0, karma: 80, t: 50 },
            { idx: 1, karma: 20, t: 30 },
            { idx: 2, karma: 15, t: 20 },
            { idx: 3, karma: 10, t: 10 },
            { idx: 4, karma: 8, t: 5 },
            { idx: 5, karma: 6, t: 0 },
            { idx: 6, karma: 5, t: 0 },
            { idx: 7, karma: 4, t: 0 },
            { idx: 8, karma: 2, t: 0 },
            { idx: 9, karma: 1, t: 0 },
          ]
        : [
            { idx: 0, karma: 12, t: 12 },
            { idx: 1, karma: 5, t: 10 },
            { idx: 2, karma: 3, t: 6 },
          ];

    for (const p of payout) {
      const u = ranked[p.idx];
      if (!u) continue;
      await prisma.user.update({
        where: { id: u.userId },
        data: { karma: { increment: p.karma }, tMoney: { increment: p.t } },
      });
    }
  }
}
