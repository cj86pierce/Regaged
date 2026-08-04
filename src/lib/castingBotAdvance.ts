/**
 * Casting day advance for CASTING_BOT - same phase rules as live casting,
 * with short bot day timers.
 */
import { prisma } from "@/lib/prisma";
import { resolveCastingNominations } from "./castingNoms";
import { resolveCastingEviction } from "./castingVotes";
import { performBotActions } from "./botActions";
import { finalizeCastingGame } from "./castingEngine";
import { BOT_DAY_MS } from "./castingDayLength";
import { pickMinigameForDay } from "./minigamePicker";
import { sampleBotChallengeScore } from "./minigames/registry";

async function assignBotChallengeScores(gameId: string, dayNumber: number) {
  const minigameId = pickMinigameForDay(gameId, dayNumber);
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, castingDayMiniGameScore: true },
  });
  for (const p of actives) {
    if ((p.castingDayMiniGameScore ?? 0) > 0) continue;
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

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!forceDue && !due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    const dayNum = game.roundNumber ?? 1;
    const dayResult = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });

    if (game.state === "ROUND_NOMINATE") {
      if (dayNum <= 1) {
        await prisma.$transaction([
          prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: 2,
              stateEndsAt: new Date(now.getTime() + BOT_DAY_MS),
            },
          }),
          prisma.gamePlayer.updateMany({
            where: { gameId, status: "ACTIVE" },
            data: { castingDayMiniGameScore: 0 },
          }),
        ]);
        return { ok: true, advanced: "day1_to_day2_nominate" as const };
      }

      if (dayResult?.nomineeUserIds?.length) {
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + BOT_DAY_MS) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      await assignBotChallengeScores(gameId, dayNum);
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
          await prisma.$transaction([
            prisma.game.update({
              where: { id: gameId },
              data: {
                state: "ROUND_NOMINATE",
                roundNumber: nextDay,
                stateEndsAt: new Date(now.getTime() + BOT_DAY_MS),
              },
            }),
            prisma.gamePlayer.updateMany({
              where: { gameId, status: "ACTIVE" },
              data: { castingDayMiniGameScore: 0 },
            }),
          ]);
          return { ok: true, fixed: "evicted_exists_forced_next_nominate" as const };
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
