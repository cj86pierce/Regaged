import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";
import { enterFrookiesJuryPhase } from "@/lib/frookiesJury";
import { BOT_ROUND_MS, getFastingNomMs, getFinal3Ms } from "@/lib/fastingTiming";

export async function resolveFastingEviction(gameId: string, opts?: { skipLock?: boolean }) {
  if (!opts?.skipLock) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true },
    });
    // Rookies use resolveRookiesEviction — do not handle here.
    if (
      !game ||
      (game.gameType !== "FASTING" &&
        game.gameType !== "FASTING_BOT" &&
        game.gameType !== "FROOKIES" &&
        game.gameType !== "FROOKIES_BOT") ||
      game.state !== "ROUND_VOTE"
    ) {
      return { ok: true, skipped: true as const };
    }

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

    const isFrookiesType = game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT";

    // Frookies continues past final 3 to final 2, then hands off to jury
    // voting instead of finishing algorithmically (see frookiesJury.ts).
    if (isFrookiesType && result.remainingActive <= 2) {
      await enterFrookiesJuryPhase(gameId);
      return { ok: true, finished: true as const };
    }
    // Fastings FAQ: final 3 starts a 12-hour clock, then placements
    const isFastingType = game.gameType === "FASTING" || game.gameType === "FASTING_BOT";
    if (isFastingType && result.remainingActive <= 3) {
      await enterFastingFinal3(gameId, game.gameType);
      return { ok: true, finished: true as const };
    }
    const nextRound = game.roundNumber + 1;
    const now2 = new Date();
    const nomMs =
      game.gameType === "FASTING_BOT" || game.gameType === "FROOKIES_BOT"
        ? BOT_ROUND_MS
        : getFastingNomMs();
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
    if (!opts?.skipLock) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
    }
  }
}

/** Fastings final 3: 12-hour clock, then place top 3 (FAQ). */
export async function enterFastingFinal3(gameId: string, gameType: string) {
  const isBot = gameType === "FASTING_BOT";
  const systemUserId = await getSystemUserId();
  const now = new Date();
  const finals = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });
  const names = finals.map((p) => p.user.username).join(", ");

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "FINAL3",
        stateEndsAt: new Date(now.getTime() + getFinal3Ms(isBot)),
        povUserId: null,
        hohUserId: null,
      },
    });
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Final 3: ${names}. A 12-hour clock has started — placements resolve when it ends.`,
      },
    });
  });
}

export async function resolveFastingFinal3IfDue(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, stateEndsAt: true },
  });
  if (!game || (game.gameType !== "FASTING" && game.gameType !== "FASTING_BOT")) {
    return { ok: true, skipped: true as const };
  }
  if (game.state !== "FINAL3") return { ok: true, skipped: true as const };
  const now = new Date();
  if (game.stateEndsAt && game.stateEndsAt.getTime() > now.getTime()) {
    return { ok: true, skipped: true as const, reason: "not_due" as const };
  }
  await finishFastingGame(gameId, game.gameType);
  return { ok: true, finished: true as const };
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
          { place: 1, karma: 25, t: 60 },
          { place: 2, karma: 3, t: 20 },
          { place: 3, karma: 0, t: 10 },
          { place: 4, karma: 0, t: 10 },
          { place: 5, karma: 0, t: 10 },
          { place: 6, karma: 0, t: 10 },
        ]
      : isRookies
        ? [
            { place: 1, karma: 80, t: 50 },
            { place: 2, karma: 20, t: 30 },
            { place: 3, karma: 15, t: 20 },
            { place: 4, karma: 10, t: 10 },
            { place: 5, karma: 8, t: 5 },
            { place: 6, karma: 6, t: 0 },
            { place: 7, karma: 5, t: 0 },
            { place: 8, karma: 4, t: 0 },
            { place: 9, karma: 2, t: 0 },
            { place: 10, karma: 1, t: 0 },
          ]
        : [
            { place: 1, karma: 12, t: 12 },
            { place: 2, karma: 5, t: 10 },
            { place: 3, karma: 3, t: 6 },
          ];

    // Pay by final eliminatedPlace across the whole game, not just the
    // handful of players still active at the moment of finishing - places
    // below whatever was still active here (e.g. Frookies 4th-6th, Rookies
    // 6th-10th) were already eliminated earlier in the game and would
    // otherwise never be looked up.
    const allPlaced = await prisma.gamePlayer.findMany({
      where: { gameId, eliminatedPlace: { in: payout.map((p) => p.place) } },
      select: { userId: true, eliminatedPlace: true },
    });

    for (const p of payout) {
      const u = allPlaced.find((x) => x.eliminatedPlace === p.place);
      if (!u) continue;
      await prisma.user.update({
        where: { id: u.userId },
        data: { karma: { increment: p.karma }, tMoney: { increment: p.t } },
      });
    }
  }

  if (gameType === "ROOKIES") {
    const { settleRookiesBets } = await import("@/lib/rookiesBets");
    await settleRookiesBets(gameId);
  }
}
