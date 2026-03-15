import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
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

// 65/35 model you picked (top3 vs chaos)
const TOP_SHARE = 0.65;

/** When caller already holds the per-game lock (e.g. advanceFastingIfDue), pass skipLock: true */
export async function assignFastingPov(gameId: string, opts?: { skipLock?: boolean }) {
  if (!opts?.skipLock) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId + "_pov"})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, povUserId: true },
    });
    if (!game) throw new Error("Game not found");
    if (game.gameType !== "FASTING" && game.gameType !== "FASTING_BOT" && game.gameType !== "FROOKIES" && game.gameType !== "ROOKIES") return { ok: true, skipped: true as const, reason: "not_fasting" };
    if (game.state !== "ROUND_NOMINATE") return { ok: true, skipped: true as const, reason: "wrong_state" };

    // ✅ hard guard
    if (game.povUserId) return { ok: true, skipped: true as const, reason: "already_set" };

    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
      orderBy: { joinedAt: "asc" },
    });

    // eligibility: can’t get POV if had it last round
    const lastRound = game.roundNumber - 1;
    const eligiblePlayers = players.filter((p) => p.lastHadPovRound !== lastRound);
    const poolBase = (eligiblePlayers.length ? eligiblePlayers : players).map((p) => ({
      userId: p.userId,
      username: p.user.username,
      weight: Math.max(1, activityScore(p)),
    }));

    if (poolBase.length === 0) return { ok: true, skipped: true as const, reason: "no_players" };

    // Build top3 list by activity weight
    const sorted = [...poolBase].sort((a, b) => b.weight - a.weight);
    const top3 = sorted.slice(0, Math.min(3, sorted.length));

    // Your weights preference
    // 1st: 18, 2nd: 16, 3rd: 12
    const weightedTop =
      top3.length >= 3
        ? [
            { ...top3[0], weight: 18 },
            { ...top3[1], weight: 16 },
            { ...top3[2], weight: 12 },
          ]
        : top3;

    const r = Math.random();
    const winner =
      poolBase.length <= 3
        ? pickWeighted(poolBase)
        : r < TOP_SHARE
          ? pickWeighted(weightedTop)
          : poolBase[Math.floor(Math.random() * poolBase.length)];

    const systemUserId = await getSystemUserId();

    // ✅ COMPARE-AND-SET: Only one request can win
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.game.updateMany({
        where: {
          id: gameId,
          gameType: { in: ["FASTING", "FASTING_BOT", "FROOKIES", "ROOKIES"] },
          state: "ROUND_NOMINATE",
          povUserId: null,
        },
        data: { povUserId: winner.userId },
      });

      if (updated.count === 0) {
        // someone else already set POV
        return { ok: true, won: false as const };
      }

      // only the winner increments + posts
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

      return { ok: true, won: true as const, povUserId: winner.userId };
    });

    return result;
  } finally {
    if (!opts?.skipLock) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId + "_pov"}))`;
    }
  }
}
