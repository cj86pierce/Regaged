/**
 * Casting day advance for CASTING_BOT - same phase rules as live casting,
 * with short bot day timers.
 */
import { prisma } from "@/lib/prisma";
import { openCastingVoteDay, resolveCastingNominations } from "./castingNoms";
import { resolveCastingEviction } from "./castingVotes";
import { performBotActions } from "./botActions";
import { finalizeCastingGame } from "./castingEngine";
import { pickMinigameForDay } from "./minigamePicker";
import { sampleBotChallengeScore } from "./minigames/registry";

async function assignBotChallengeScores(gameId: string, dayNumber: number) {
  const minigameId = pickMinigameForDay(gameId, dayNumber);
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: {
      userId: true,
      castingDayMiniGameScore: true,
      user: { select: { email: true, usernameLower: true } },
    },
  });
  for (const p of actives) {
    if ((p.castingDayMiniGameScore ?? 0) > 0) continue;
    const isBot =
      p.user.email?.endsWith("@regaged.bot") || p.user.usernameLower.startsWith("bot_");
    if (!isBot) continue;
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: p.userId } },
      data: { castingDayMiniGameScore: sampleBotChallengeScore(minigameId) },
    });
  }
}

export async function advanceCastingBotIfDue(gameId: string, options?: { forceDue?: boolean }) {
  const forceDue = options?.forceDue === true;

  if (!forceDue) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "lock" as const };
  }

  try {
    const now = new Date();

    try {
      await performBotActions(gameId);
    } catch (e) {
      console.error("CASTING_BOT bot actions failed", { gameId, err: String(e) });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true },
    });
    if (!game || game.gameType !== "CASTING_BOT") return { ok: false, error: "not_casting_bot" as const };

    const dayNum = game.roundNumber ?? 1;
    const needsNomsHeal = game.state === "ROUND_NOMINATE" && dayNum >= 2;

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!forceDue && !due && !stuck && !missingTimer && !needsNomsHeal) {
      return { ok: true, skipped: true as const, reason: "not_due" as const };
    }

    const dayResult = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });

    if (game.state === "ROUND_NOMINATE") {
      if (dayNum <= 1) {
        await assignBotChallengeScores(gameId, 1);
        const result = await openCastingVoteDay(gameId, 2);
        if (result === "finalized") return { ok: true, advanced: "finalized" as const };
        if (result === "vote") return { ok: true, advanced: "day1_to_day2_vote" as const };
        return { ok: true, skipped: true as const, reason: "noms_noop" as const };
      }

      if (dayResult?.nomineeUserIds?.length) {
        const { BOT_DAY_MS } = await import("./castingDayLength");
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + BOT_DAY_MS) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      await assignBotChallengeScores(gameId, dayNum);
      const result = await openCastingVoteDay(gameId, dayNum);
      if (result === "finalized") return { ok: true, advanced: "finalized" as const };
      if (result === "vote") return { ok: true, advanced: "noms" as const };
      await resolveCastingNominations(gameId);
      return { ok: true, advanced: "noms" as const };
    }

    if (game.state === "ROUND_VOTE") {
      if (dayResult?.evictedUserIds?.length || (dayNum === 1 && dayResult)) {
        const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        if (activeCount <= 5) {
          await finalizeCastingGame(gameId);
          return { ok: true, fixed: "evicted_exists_forced_complete" as const };
        }

        if (game.roundNumber === dayNum) {
          const nextDay = dayNum + 1;
          await assignBotChallengeScores(gameId, dayNum);
          const result = await openCastingVoteDay(gameId, nextDay);
          if (result === "finalized") return { ok: true, fixed: "evicted_exists_forced_complete" as const };
          if (result === "vote") return { ok: true, fixed: "evicted_exists_forced_next_vote" as const };
          return { ok: true, skipped: true as const, reason: "noms_noop" as const };
        }
        return { ok: true, skipped: true as const, reason: "already_advanced" as const };
      }

      await resolveCastingEviction(gameId);
      return { ok: true, advanced: "vote" as const };
    }

    return { ok: true, skipped: true as const, reason: "wrong_state" as const };
  } finally {
    if (!forceDue) {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
    }
  }
}
