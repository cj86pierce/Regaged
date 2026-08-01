import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

/** Assign POV for Frookies: highest mini-game (competition) score wins. Ties: checks (plus−minus), then random. */
export async function assignFrookiesPov(gameId: string, opts?: { skipLock?: boolean }) {
  if (!opts?.skipLock) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId + "_pov_f"})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" as const };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, povUserId: true },
    });
    if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) return { ok: true, skipped: true as const, reason: "not_frookies" as const };
    if (game.state !== "ROUND_NOMINATE") return { ok: true, skipped: true as const, reason: "wrong_state" as const };
    if (game.povUserId) return { ok: true, skipped: true as const, reason: "already_set" as const };

    const players = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
      orderBy: { joinedAt: "asc" },
    });
    if (players.length === 0) return { ok: true, skipped: true as const, reason: "no_players" as const };

    // Highest score wins; ties: plusCount - minusCount desc, then random
    const withTieBreak = players.map((p) => ({
      ...p,
      score: p.castingDayMiniGameScore ?? 0,
      checks: (p.plusCount ?? 0) - (p.minusCount ?? 0),
      rnd: Math.random(),
    }));
    withTieBreak.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.checks !== b.checks) return b.checks - a.checks;
      return a.rnd - b.rnd;
    });
    const winner = withTieBreak[0]!;

    const systemUserId = await getSystemUserId();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.game.updateMany({
        where: {
          id: gameId,
          gameType: { in: ["FROOKIES", "FROOKIES_BOT"] },
          state: "ROUND_NOMINATE",
          povUserId: null,
        },
        data: { povUserId: winner.userId },
      });

      if (updated.count === 0) return { ok: true, won: false as const };

      // Winning the POV competition costs health (random amount), per the
      // original game's rule - be strategic about when to compete.
      const healthCost = 5 + Math.floor(Math.random() * 11); // 5-15
      const currentHealth = winner.health ?? 70;
      const newHealth = Math.max(10, currentHealth - healthCost);

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: winner.userId } },
        data: { povWins: { increment: 1 }, lastHadPovRound: game.roundNumber, health: newHealth },
      });

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] Competition winner (POV): ${winner.user.username}. They may save themselves or one other player before noms.`,
        },
      });

      return { ok: true, won: true as const, povUserId: winner.userId };
    });

    return result;
  } finally {
    if (!opts?.skipLock) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId + "_pov_f"}))`;
    }
  }
}
