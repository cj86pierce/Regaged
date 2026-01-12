import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/**
 * Assign POV for FASTING.
 * force=true is DEV-only reroll.
 */
export async function assignFastingPov(gameId: string, force = false) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true, povUserId: true },
  });

  if (!game) throw new Error("Game not found");
  if (game.gameType !== "FASTING") throw new Error("Not a FASTING game");
  if (game.state !== "ROUND_NOMINATE") throw new Error("POV can only be assigned in ROUND_NOMINATE");

  if (game.povUserId && !force) {
    return { ok: true, povUserId: game.povUserId, alreadyAssigned: true };
  }

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (players.length < 3) throw new Error("Not enough players");

  const excludedRound = game.roundNumber - 1;

  const eligible = players
    .filter((p) => p.lastHadPovRound !== excludedRound)
    .map((p) => {
      const score = activityScore(p);
      return {
        userId: p.userId,
        username: p.user.username,
        weight: Math.max(1, score),
      };
    });

  const pool =
    eligible.length > 0
      ? eligible
      : players.map((p) => ({ userId: p.userId, username: p.user.username, weight: 1 }));

  const winner = pickWeighted(pool);
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: { povUserId: winner.userId },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: winner.userId } },
      data: { povWins: { increment: 1 }, lastHadPovRound: game.roundNumber },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] POV awarded to ${winner.username}.`,
      },
    });
  });

  return { ok: true, povUserId: winner.userId, username: winner.username };
}
