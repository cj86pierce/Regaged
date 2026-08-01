import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { finishFastingGame } from "@/lib/fastingVotes";

const ROOKIES_DAY_MS = 24 * 60 * 60 * 1000;
const ROOKIES_DAY_7 = 7;

/**
 * Classic Rookies eviction (FAQ):
 * - Rank nominees with 0–3 points (3 = most want out)
 * - Evict the two highest point totals (one if only 3 nominees / final 5)
 * - If POV was used on one of those, replace with the next-highest
 * - Place top 3 when ≤3 remain
 */
export async function resolveRookiesEviction(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const };

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameType: true,
        state: true,
        roundNumber: true,
        povUserId: true,
        povSavedUserId: true,
      },
    });
    if (!game || game.gameType !== "ROOKIES" || game.state !== "ROUND_VOTE") return { ok: true, skipped: true as const };

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: {
        nomineeAUserId: true,
        nomineeBUserId: true,
        nomineeCUserId: true,
        nomineeDUserId: true,
        evictedUserId: true,
        povSavedUserId: true,
      },
    });
    if (!rr || rr.evictedUserId) return { ok: true, skipped: true as const };

    const nominees = [
      rr.nomineeAUserId,
      rr.nomineeBUserId,
      rr.nomineeCUserId,
      rr.nomineeDUserId,
    ].filter(Boolean) as string[];
    if (nominees.length < 2) return { ok: true, skipped: true as const };

    const scoreByNominee = new Map<string, number>();
    for (const n of nominees) scoreByNominee.set(n, 0);

    if (nominees.length === 2) {
      const evictionVotes = await prisma.evictionVote.findMany({
        where: { gameId, roundNumber: game.roundNumber },
        select: { targetUserId: true },
      });
      for (const v of evictionVotes) {
        if (scoreByNominee.has(v.targetUserId)) {
          scoreByNominee.set(v.targetUserId, (scoreByNominee.get(v.targetUserId) ?? 0) + 1);
        }
      }
    } else {
      const rankingVotes = await prisma.rankingVote.findMany({
        where: { gameId, roundNumber: game.roundNumber },
        select: { targetUserId: true, points: true },
      });
      for (const v of rankingVotes) {
        if (!nominees.includes(v.targetUserId)) continue;
        scoreByNominee.set(v.targetUserId, (scoreByNominee.get(v.targetUserId) ?? 0) + v.points);
      }
    }

    const ranked = nominees
      .map((id) => ({ userId: id, score: scoreByNominee.get(id) ?? 0 }))
      .sort((a, b) => b.score - a.score || Math.random() - 0.5);

    // POV immunity: explicit save, else POV holder if they are a nominee
    const povImmune =
      game.povSavedUserId ??
      rr.povSavedUserId ??
      (game.povUserId && nominees.includes(game.povUserId) ? game.povUserId : null);

    const evictCount = nominees.length >= 4 ? 2 : 1;
    const evicted: string[] = [];
    for (const r of ranked) {
      if (evicted.length >= evictCount) break;
      if (povImmune && r.userId === povImmune) continue;
      evicted.push(r.userId);
    }
    // If POV blocked everyone somehow, fall back without immunity
    if (evicted.length < evictCount) {
      for (const r of ranked) {
        if (evicted.length >= evictCount) break;
        if (!evicted.includes(r.userId)) evicted.push(r.userId);
      }
    }

    const systemUserId = await getSystemUserId();
    const now = new Date();
    // Store first eviction on RoundResult for recovery; both are eliminated
    const primaryEvicted = evicted[0]!;

    await prisma.$transaction(async (tx) => {
      await tx.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { evictedUserId: primaryEvicted },
      });

      for (const uid of evicted) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: uid } },
          data: { status: "ELIMINATED", eliminatedAt: now },
        });
        const remainingActive = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: uid } },
          data: { eliminatedPlace: remainingActive + 1 },
        });
      }

      const users = await tx.user.findMany({
        where: { id: { in: [...nominees, ...evicted] } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;
      const lines = nominees.map((id) => {
        const s = scoreByNominee.get(id) ?? 0;
        const out = evicted.includes(id) ? "OUT" : povImmune === id ? "POV" : "";
        return `${nameOf(id)}|${s}|${out}`;
      });

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM:EVICT_ROOKIES]\n${lines.join("\n")}`,
        },
      });
    });

    const remainingActive = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    // FAQ: top 3 place by activity when final 3 reached
    if (remainingActive <= 3) {
      await finishFastingGame(gameId, "ROOKIES");
      return { ok: true, finished: true as const };
    }

    const nextRound = game.roundNumber + 1;
    const isDay7 = nextRound >= ROOKIES_DAY_7;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: nextRound,
        povUserId: null,
        hohUserId: null,
        povSavedUserId: null,
        roundStartedAt: now,
        stateEndsAt: new Date(now.getTime() + ROOKIES_DAY_MS),
      },
    });

    if (!isDay7) {
      try {
        await assignRookiesHoh(gameId, { random: false, skipLock: true });
      } catch {}
    }

    const game2 = await prisma.game.findUnique({
      where: { id: gameId },
      select: { hohUserId: true, state: true },
    });
    if (game2?.state === "ROUND_NOMINATE" && nextRound >= 2 && nextRound < ROOKIES_DAY_7) {
      const { assignFastingPov } = await import("@/lib/fastingPov");
      try {
        await assignFastingPov(gameId, { skipLock: true });
      } catch {}
    }

    return { ok: true, advancedToRound: nextRound };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
