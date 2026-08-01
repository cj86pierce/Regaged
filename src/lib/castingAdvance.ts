/**
 * Casting day advance - Fasting-style day rolling.
 * Advisory lock, due check, state machine with recovery.
 *
 * Day flow (wiki-aligned):
 *   ROUND_NOMINATE (full day: compete / collect keys) → pick nominees →
 *   ROUND_VOTE (full day: cast 1/2/3 points) → evict → next ROUND_NOMINATE
 * Day 1 has no nominees; when due it rolls into day 2 nominate.
 */
import { prisma } from "@/lib/prisma";
import { resolveCastingNominations } from "./castingNoms";
import { resolveCastingEviction } from "./castingVotes";
import { getDayMsForGame } from "./castingDayLength";
import { finalizeCastingGame } from "./castingEngine";

export async function advanceCastingIfDue(gameId: string, options?: { forceDue?: boolean }) {
  const forceDue = options?.forceDue === true;

  if (!forceDue) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "lock" as const };
  }

  try {
    const now = new Date();

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true },
    });
    if (!game || game.gameType !== "CASTING") return { ok: false, error: "not_casting" as const };

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!forceDue && !due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    const dayNum = game.roundNumber ?? 1;
    const dayResult = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });

    // -------------------------
    // ROUND_NOMINATE
    // -------------------------
    if (game.state === "ROUND_NOMINATE") {
      // Day 1: no noms — roll into day 2 nominate window
      if (dayNum <= 1) {
        const dayMs = await getDayMsForGame(gameId);
        await prisma.$transaction([
          prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: 2,
              stateEndsAt: new Date(now.getTime() + dayMs),
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
        const dayMs = await getDayMsForGame(gameId);
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + dayMs) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      await resolveCastingNominations(gameId);
      return { ok: true, advanced: "noms" as const };
    }

    // -------------------------
    // ROUND_VOTE
    // -------------------------
    if (game.state === "ROUND_VOTE") {
      if (dayResult?.evictedUserIds?.length || (dayNum === 1 && dayResult)) {
        const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        if (activeCount <= 5) {
          await finalizeCastingGame(gameId);
          return { ok: true, fixed: "evicted_exists_forced_complete" as const };
        }

        // Already resolved — ensure we're on the next nominate day (do not pick noms yet)
        if (game.roundNumber === dayNum) {
          const nextDay = dayNum + 1;
          const dayMs = await getDayMsForGame(gameId);
          await prisma.$transaction([
            prisma.game.update({
              where: { id: gameId },
              data: {
                state: "ROUND_NOMINATE",
                roundNumber: nextDay,
                stateEndsAt: new Date(now.getTime() + dayMs),
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
