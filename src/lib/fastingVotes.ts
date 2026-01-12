import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const FASTING_NOM_MS = 2 * 60 * 1000; // 2 minutes

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

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const a = players.find((p) => p.userId === rr.nomineeAUserId);
  const b = players.find((p) => p.userId === rr.nomineeBUserId);
  if (!a || !b) throw new Error("Nominees not active");

  const votes = await prisma.evictionVote.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const countA = votes.filter((v) => v.targetUserId === rr.nomineeAUserId).length;
  const countB = votes.filter((v) => v.targetUserId === rr.nomineeBUserId).length;

  let evicted = a;
  let saved = b;

  if (countB > countA) {
    evicted = b;
    saved = a;
  } else if (countA === countB) {
    const actA = activityScore(a);
    const actB = activityScore(b);
    if (actB < actA) {
      evicted = b;
      saved = a;
    }
  }

  const activeAfter = players.length - 1;
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.update({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      data: { evictedUserId: evicted.userId },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: evicted.userId } },
      data: { status: "ELIMINATED", eliminatedAt: new Date() },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Evicted: ${evicted.user.username} (${countA}-${countB}).`,
      },
    });

    // keep your current endgame behavior (whatever you currently have)
    // If you are still using FINAL3 -> COMPLETED logic elsewhere, this will still work.
    // We only change phase timers for continuing rounds.
    if (activeAfter <= 3) {
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "FINAL3",
          // leave your existing final3 timing/logic as-is elsewhere
          // if you already changed it to instant end, this will be overwritten by that flow
        },
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
