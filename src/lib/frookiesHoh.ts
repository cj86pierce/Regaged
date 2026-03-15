import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return Math.max(0, p.chatCount + 2 * p.plusCount - p.minusCount);
}

/** Assign HOH for Frookies: random on round 1, activity-based otherwise (same idea as Rookies). */
export async function assignFrookiesHoh(
  gameId: string,
  opts: { random?: boolean; skipLock?: boolean } = {}
) {
  if (!opts?.skipLock) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId + "_hoh_f"})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" as const };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, hohUserId: true },
    });
    if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) return { ok: true, skipped: true as const, reason: "not_frookies" as const };
    if (game.state !== "ROUND_NOMINATE") return { ok: true, skipped: true as const, reason: "wrong_state" as const };
    if (game.hohUserId) return { ok: true, skipped: true as const, reason: "already_set" as const };

    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
      orderBy: { joinedAt: "asc" },
    });
    if (players.length === 0) return { ok: true, skipped: true as const, reason: "no_players" as const };

    const prevRound = game.roundNumber - 1;
    const prevHoh =
      prevRound >= 1
        ? await prisma.game.findFirst({
            where: { id: gameId },
            select: { hohUserId: true },
          }).then((g) => g?.hohUserId)
        : null;
    const eligible = prevHoh ? players.filter((p) => p.userId !== prevHoh) : players;
    const pool = eligible.length ? eligible : players;

    let winner: (typeof pool)[0];
    if (opts.random || game.roundNumber === 1) {
      winner = pool[Math.floor(Math.random() * pool.length)]!;
    } else {
      const withScore = pool.map((p) => ({ ...p, score: activityScore(p) }));
      withScore.sort((a, b) => b.score - a.score);
      const top = withScore.slice(0, Math.min(3, withScore.length));
      const total = top.reduce((s, p) => s + Math.max(1, p.score), 0);
      let r = Math.random() * total;
      winner = top[0]!;
      for (const p of top) {
        r -= Math.max(1, p.score);
        if (r <= 0) {
          winner = p;
          break;
        }
      }
    }

    const systemUserId = await getSystemUserId();

    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: { hohUserId: winner.userId },
      });
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] HOH for Round ${game.roundNumber}: ${winner.user.username}.`,
        },
      });
    });

    return { ok: true, hohUserId: winner.userId };
  } finally {
    if (!opts.skipLock) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId + "_hoh_f"}))`;
    }
  }
}
