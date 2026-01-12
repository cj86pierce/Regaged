import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const FASTING_NOM_MS = 2 * 60 * 1000;

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

type Ranked = {
  userId: string;
  username: string;
  povWins: number;
  plusCount: number;
  activity: number;
};

function rankFinal3(players: Ranked[]) {
  return [...players].sort((a, b) => {
    if (b.povWins !== a.povWins) return b.povWins - a.povWins;
    if (b.plusCount !== a.plusCount) return b.plusCount - a.plusCount;
    if (b.activity !== a.activity) return b.activity - a.activity;
    return Math.random() < 0.5 ? -1 : 1;
  });
}

export async function resolveFastingEviction(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game) throw new Error("Game not found");
  if (game.gameType !== "FASTING") throw new Error("Not a FASTING game");
  if (game.state !== "ROUND_VOTE") throw new Error("Not in voting phase");

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
  });
  if (!rr) throw new Error("Nominees not set");
  if (rr.evictedUserId) return { ok: true, alreadyResolved: true, evictedUserId: rr.evictedUserId };

  const activePlayers = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const activeCountBefore = activePlayers.length;

  const a = activePlayers.find((p) => p.userId === rr.nomineeAUserId);
  const b = activePlayers.find((p) => p.userId === rr.nomineeBUserId);
  if (!a || !b) throw new Error("Nominees not active");

  const votes = await prisma.evictionVote.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const countA = votes.filter((v) => v.targetUserId === rr.nomineeAUserId).length;
  const countB = votes.filter((v) => v.targetUserId === rr.nomineeBUserId).length;

  let evicted = a;
  if (countB > countA) evicted = b;
  if (countA === countB) {
    const actA = activityScore(a);
    const actB = activityScore(b);
    if (actB < actA) evicted = b;
  }

  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.update({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      data: { evictedUserId: evicted.userId },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: evicted.userId } },
      data: {
        status: "ELIMINATED",
        eliminatedAt: new Date(),
        eliminatedPlace: activeCountBefore, // 15th, 14th, ...
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Evicted: ${evicted.user.username}.`,
      },
    });

    const remaining = await tx.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
    });

    if (remaining.length <= 3) {
      const ranked = rankFinal3(
        remaining.map((p) => ({
          userId: p.userId,
          username: p.user.username,
          povWins: p.povWins,
          plusCount: p.plusCount,
          activity: activityScore(p),
        }))
      );

      const [first, second, third] = ranked;

      // store placements
      if (first) await tx.gamePlayer.update({ where: { gameId_userId: { gameId, userId: first.userId } }, data: { eliminatedPlace: 1 } });
      if (second) await tx.gamePlayer.update({ where: { gameId_userId: { gameId, userId: second.userId } }, data: { eliminatedPlace: 2 } });
      if (third) await tx.gamePlayer.update({ where: { gameId_userId: { gameId, userId: third.userId } }, data: { eliminatedPlace: 3 } });

      // pay rewards
      if (first) await tx.user.update({ where: { id: first.userId }, data: { karma: { increment: 12 }, tMoney: { increment: 12 } } });
      if (second) await tx.user.update({ where: { id: second.userId }, data: { karma: { increment: 5 }, tMoney: { increment: 10 } } });
      if (third) await tx.user.update({ where: { id: third.userId }, data: { karma: { increment: 3 }, tMoney: { increment: 6 } } });

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] Final results: 1st ${first?.username ?? "?"}, 2nd ${second?.username ?? "?"}, 3rd ${third?.username ?? "?"}.`,
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: { state: "COMPLETED", stateEndsAt: null, povUserId: null, completedAt: new Date() },
      });
    } else {
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_NOMINATE",
          roundNumber: { increment: 1 },
          stateEndsAt: new Date(Date.now() + FASTING_NOM_MS),
          povUserId: null,
        },
      });
    }
  });

  return { ok: true, evictedUserId: evicted.userId };
}
