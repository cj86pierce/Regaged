/**
 * Casting day advance.
 *
 * Day 1: compete only (talk, challenge, keys) — no nominations.
 * Day 2+: nominations open immediately and stay in the cycle until finals (≤5).
 * Vote days still allow keys/challenge; those scores feed the next day's noms.
 */
import { prisma } from "@/lib/prisma";
import { openCastingVoteDay, resolveCastingNominations } from "./castingNoms";
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

    const dayNum = game.roundNumber ?? 1;
    // Day 2+ should never sit in a compete-only nominate window (legacy / mid-game heal).
    const needsNomsHeal = game.state === "ROUND_NOMINATE" && dayNum >= 2;

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!forceDue && !due && !stuck && !missingTimer && !needsNomsHeal) {
      return { ok: true, skipped: true as const, reason: "not_due" as const };
    }

    if (missingTimer && !needsNomsHeal) {
      const dayMs = await getDayMsForGame(gameId);
      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(now.getTime() + Math.min(dayMs, 60 * 60 * 1000)) },
      });
      return { ok: true, fixed: "restored_missing_timer" as const };
    }

    const dayResult = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      select: { nomineeUserIds: true, evictedUserIds: true },
    });

    // -------------------------
    // ROUND_NOMINATE
    // -------------------------
    if (game.state === "ROUND_NOMINATE") {
      // Day 1 ends → Day 2 opens with noms + vote (no second compete-only day)
      if (dayNum <= 1) {
        const result = await openCastingVoteDay(gameId, 2);
        if (result === "finalized") return { ok: true, advanced: "finalized" as const };
        if (result === "vote") return { ok: true, advanced: "day1_to_day2_vote" as const };
        return { ok: true, skipped: true as const, reason: "noms_noop" as const };
      }

      // Day 2+: open / resume vote with noms (heals live games stuck on compete-only day 2)
      if (dayResult?.nomineeUserIds?.length) {
        const dayMs = await getDayMsForGame(gameId);
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + dayMs) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      const result = await openCastingVoteDay(gameId, dayNum);
      if (result === "finalized") return { ok: true, advanced: "finalized" as const };
      if (result === "vote") return { ok: true, advanced: "noms" as const };
      // Fallback if openCastingVoteDay no-oped
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

        if (game.roundNumber === dayNum) {
          const nextDay = dayNum + 1;
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
