/**
 * Casting day advance for CASTING_BOT - Fasting-style day rolling.
 * Same pattern as fastingBotAdvance.
 */
import { prisma } from "@/lib/prisma";
import { resolveCastingNominations } from "./castingNoms";
import { resolveCastingEviction } from "./castingVotes";
import { performBotActions } from "./botActions";

const BOT_DAY_MS = 2 * 60 * 1000; // 2 min for testing

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
      if (dayNum <= 1) return { ok: true, skipped: true as const, reason: "day1_no_nom" as const };

      if (dayResult?.nomineeUserIds?.length) {
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + BOT_DAY_MS) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      await resolveCastingNominations(gameId);
      return { ok: true, advanced: "noms" as const };
    }

    if (game.state === "ROUND_VOTE") {
      if (dayResult?.evictedUserIds?.length) {
        const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        if (activeCount <= 4) {
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "COMPLETED", stateEndsAt: null, completedAt: new Date() },
          });
          return { ok: true, fixed: "evicted_exists_forced_complete" as const };
        }

        const nextDay = dayNum + 1;
        await prisma.game.update({
          where: { id: gameId },
          data: {
            state: "ROUND_NOMINATE",
            roundNumber: nextDay,
            stateEndsAt: new Date(now.getTime() + BOT_DAY_MS),
          },
        });
        await resolveCastingNominations(gameId);
        return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
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
