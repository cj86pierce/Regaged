import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const TOP3_WEIGHTS = [18, 16, 12] as const;
const CHAOS_PCT = 0.35; // ✅ 35% chaos, 65% top-3

type Stat = {
  userId: string;
  username: string;
  chats: number;
  plus: number;
  minus: number;
  score: number;
};

function score(chats: number, plus: number, minus: number) {
  // round-scoped activity score (simple & fair)
  return chats + plus - minus;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

export async function assignFastingPov(gameId: string) {
  // 🔒 prevent concurrent POV assignment
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) {
    return { ok: true, skipped: true, reason: "locked" as const };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameType: true,
        state: true,
        roundNumber: true,
        povUserId: true,
        roundStartedAt: true,
        startsAt: true,
      },
    });

    if (!game) return { ok: false, error: "Game not found" as const };
    if (game.gameType !== "FASTING") return { ok: true, skipped: true, reason: "not_fasting" as const };
    if (game.state !== "ROUND_NOMINATE") return { ok: true, skipped: true, reason: "wrong_state" as const };

    // ✅ POV already set = do nothing
    if (game.povUserId) return { ok: true, skipped: true, reason: "already_set" as const };

    // Round window
    const windowStart = game.roundStartedAt ?? game.startsAt ?? new Date(Date.now() - 10 * 60 * 1000);
    const windowEnd = new Date();

    // Active players
    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
    });
    if (players.length === 0) return { ok: false, error: "No players" as const };

    // No back-to-back POV
    const lastRound = game.roundNumber - 1;
    const eligiblePlayers = players.filter((p) => p.lastHadPovRound !== lastRound);
    const eligible = eligiblePlayers.length ? eligiblePlayers : players;

    const eligibleIds = eligible.map((p) => p.userId);

    // Round-scoped chat count (messages created this round)
    const chatCounts = await prisma.gameMessage.groupBy({
      by: ["userId"],
      where: {
        gameId,
        channel: "PUBLIC",
        createdAt: { gte: windowStart, lte: windowEnd },
        userId: { in: eligibleIds },
      },
      _count: { _all: true },
    });
    const chatMap = new Map<string, number>();
    for (const r of chatCounts) chatMap.set(r.userId, r._count._all);

    // Round-scoped reactions, only on round-scoped messages
    const reactions = await prisma.messageReaction.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        message: {
          gameId,
          channel: "PUBLIC",
          createdAt: { gte: windowStart, lte: windowEnd },
          userId: { in: eligibleIds },
        },
      },
      select: { type: true, message: { select: { userId: true } } },
    });

    const plusMap = new Map<string, number>();
    const minusMap = new Map<string, number>();
    for (const r of reactions) {
      const targetId = r.message.userId;
      if (!targetId) continue;
      if (r.type === "PLUS") plusMap.set(targetId, (plusMap.get(targetId) ?? 0) + 1);
      else minusMap.set(targetId, (minusMap.get(targetId) ?? 0) + 1);
    }

    const stats: Stat[] = eligible.map((p) => {
      const chats = chatMap.get(p.userId) ?? 0;
      const plus = plusMap.get(p.userId) ?? 0;
      const minus = minusMap.get(p.userId) ?? 0;
      return {
        userId: p.userId,
        username: p.user.username,
        chats,
        plus,
        minus,
        score: score(chats, plus, minus),
      };
    });

    // Rank top3: score desc, fewer minus better, more plus better, then random
    const ranked = shuffle([...stats]).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.minus !== b.minus) return a.minus - b.minus;
      if (b.plus !== a.plus) return b.plus - a.plus;
      return 0;
    });

    let winner: { userId: string; username: string };

    if (ranked.length <= 3) {
      // use 18/16/12 weighting even with small pools
      const weighted = ranked.map((p, idx) => ({ ...p, weight: TOP3_WEIGHTS[idx] ?? 12 }));
      const w = pickWeighted(weighted);
      winner = { userId: w.userId, username: w.username };
    } else {
      const r = Math.random();

      if (r < CHAOS_PCT) {
        // 35% chaos: equal odds among all eligible
        const idx = (Math.random() * ranked.length) | 0;
        winner = { userId: ranked[idx].userId, username: ranked[idx].username };
      } else {
        // 65% top 3 with fixed weights
        const top3 = ranked.slice(0, 3);
        const weightedTop = top3.map((p, idx) => ({ ...p, weight: TOP3_WEIGHTS[idx] }));
        const w = pickWeighted(weightedTop);
        winner = { userId: w.userId, username: w.username };
      }
    }

    const systemUserId = await getSystemUserId();

    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: { povUserId: winner.userId },
      });

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: winner.userId } },
        data: {
          povWins: { increment: 1 },
          lastHadPovRound: game.roundNumber,
        },
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

    return { ok: true, povUserId: winner.userId, chaosPct: CHAOS_PCT };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
