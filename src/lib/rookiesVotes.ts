import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { finishFastingGame } from "@/lib/fastingVotes";

const ROOKIES_DAY_MS = 24 * 60 * 60 * 1000;
const ROOKIES_DAY_7 = 7;

/** Resolve Rookies eviction from ranking votes (3=evict, 2=evict if #1 saved, 1=save). Evict nominee with highest eviction score. */
export async function resolveRookiesEviction(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const };

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true },
    });
    if (!game || game.gameType !== "ROOKIES" || game.state !== "ROUND_VOTE") return { ok: true, skipped: true as const };

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, nomineeCUserId: true, evictedUserId: true },
    });
    if (!rr || rr.evictedUserId) return { ok: true, skipped: true as const };

    const nominees = [rr.nomineeAUserId, rr.nomineeBUserId, rr.nomineeCUserId].filter(Boolean) as string[];
    if (nominees.length < 2) return { ok: true, skipped: true as const };

    let evictedUserId: string;
    const scoreByNominee = new Map<string, number>();

    if (nominees.length === 2) {
      const evictionVotes = await prisma.evictionVote.findMany({
        where: { gameId, roundNumber: game.roundNumber },
        select: { targetUserId: true },
      });
      const votesA = evictionVotes.filter((v) => v.targetUserId === nominees[0]).length;
      const votesB = evictionVotes.filter((v) => v.targetUserId === nominees[1]).length;
      scoreByNominee.set(nominees[0]!, votesA);
      scoreByNominee.set(nominees[1]!, votesB);
      evictedUserId =
        votesA === votesB
          ? (Math.random() < 0.5 ? nominees[0]! : nominees[1]!)
          : votesA > votesB
            ? nominees[0]!
            : nominees[1]!;
    } else {
      const rankingVotes = await prisma.rankingVote.findMany({
        where: { gameId, roundNumber: game.roundNumber },
        select: { targetUserId: true, points: true },
      });
      for (const n of nominees) scoreByNominee.set(n, 0);
      for (const v of rankingVotes) {
        if (!nominees.includes(v.targetUserId)) continue;
        scoreByNominee.set(v.targetUserId, (scoreByNominee.get(v.targetUserId) ?? 0) + v.points);
      }
      const withScore = nominees.map((id) => ({ userId: id, score: scoreByNominee.get(id) ?? 0 }));
      withScore.sort((a, b) => b.score - a.score);
      evictedUserId =
        withScore[0]!.score === withScore[1]?.score
          ? (Math.random() < 0.5 ? withScore[0]!.userId : withScore[1]!.userId)
          : withScore[0]!.userId;
    }

    const systemUserId = await getSystemUserId();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { evictedUserId },
      });

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { status: "ELIMINATED", eliminatedAt: now },
      });

      const remainingActive = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      const place = remainingActive + 1;
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evictedUserId } },
        data: { eliminatedPlace: place },
      });

      const users = await tx.user.findMany({
        where: { id: { in: [...nominees, evictedUserId] } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;
      const lines = nominees.map((id) => {
        const s = scoreByNominee.get(id) ?? 0;
        return `${nameOf(id)}|${s}|${id === evictedUserId ? "OUT" : ""}`;
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
    if (remainingActive <= 2) {
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
        roundStartedAt: now,
        stateEndsAt: new Date(now.getTime() + ROOKIES_DAY_MS),
      },
    });

    if (!isDay7) {
      try {
        await assignRookiesHoh(gameId, { random: false, skipLock: true });
      } catch {}
    }

    // POV only from day 2 onward; day 7 no HOH so no POV needed for noms
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
