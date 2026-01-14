import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  // existing simple score (we’ll tune later w/ per-round deltas + anti-spam)
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

function pickWeighted(items: { userId: string; username: string; weight: number }[]) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export async function assignFastingPov(gameId: string) {
  // 🔒 lock per game so POV can never be assigned twice by concurrent requests
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) {
    // someone else is assigning right now
    return { ok: true, skipped: true, reason: "locked" as const };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, povUserId: true },
    });
    if (!game) throw new Error("Game not found");
    if (game.gameType !== "FASTING") throw new Error("Not FASTING");
    if (game.state !== "ROUND_NOMINATE") return { ok: true, skipped: true, reason: "wrong_state" as const };

    // ✅ hard guard: if pov already set, do nothing
    if (game.povUserId) return { ok: true, skipped: true, reason: "already_set" as const };

    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
      orderBy: { joinedAt: "asc" },
    });

    // eligibility: can’t get POV if had it last round
    const lastRound = game.roundNumber - 1;
    const eligible = players.filter((p) => p.lastHadPovRound !== lastRound);

    const pool = (eligible.length ? eligible : players).map((p) => ({
      userId: p.userId,
      username: p.user.username,
      weight: Math.max(1, activityScore(p)),
    }));

    // 🎲 Model B (60/40) – temporary v1 implementation:
    // 60%: top 3 weighted (18/16/12), 40%: random among all eligible
    const r = Math.random();
    let winner: { userId: string; username: string };

    if (pool.length <= 3) {
      winner = pickWeighted(pool);
    } else if (r < 0.4) {
      // 40% random among all eligible (equal odds)
      const idx = Math.floor(Math.random() * pool.length);
      winner = { userId: pool[idx].userId, username: pool[idx].username };
    } else {
      // 60%: top 3 by weight with fixed weights
      const top3 = [...pool].sort((a, b) => b.weight - a.weight).slice(0, 3);
      const weightedTop = [
        { ...top3[0], weight: 18 },
        { ...top3[1], weight: 16 },
        { ...top3[2], weight: 12 },
      ];
      winner = pickWeighted(weightedTop);
    }

    const systemUserId = await getSystemUserId();

    await prisma.$transaction(async (tx) => {
      // set POV once
      await tx.game.update({ where: { id: gameId }, data: { povUserId: winner.userId } });

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

    return { ok: true, povUserId: winner.userId };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
