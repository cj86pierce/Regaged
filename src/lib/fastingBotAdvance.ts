/**
 * 60-second fasting advance + bot actions for FASTING_BOT games.
 * Does not modify original fastingAdvance.
 */
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";
import { performBotActions } from "@/lib/botActions";

const BOT_ROUND_MS = 2 * 60 * 1000; // 2 min for testing

export async function advanceFastingBotIfDue(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" as const };

  try {
    const now = new Date();

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true },
    });
    if (!game || (game.gameType !== "FASTING_BOT" && game.gameType !== "FROOKIES_BOT" && game.gameType !== "ROOKIES_BOT")) return { ok: false, error: "not_fasting_bot" as const };

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    // Trigger bot actions before advancing
    try {
      await performBotActions(gameId);
    } catch (e) {
      console.error("FASTING_BOT bot actions failed", { gameId, err: String(e) });
    }

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
    });

    if (game.state === "ROUND_NOMINATE") {
      if (!game.povUserId) {
        try {
          await assignFastingPov(gameId, { skipLock: true });
        } catch {}
      }

      if (rr?.nomineeAUserId && rr?.nomineeBUserId) {
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + BOT_ROUND_MS) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      await resolveFastingNominations(gameId);
      return { ok: true, advanced: "noms" as const };
    }

    if (game.state === "ROUND_VOTE") {
      if (rr?.evictedUserId) {
        const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

        if (activeCount <= 3) {
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "COMPLETED", stateEndsAt: null, povUserId: null, completedAt: new Date() },
          });
          return { ok: true, fixed: "evicted_exists_forced_complete" as const };
        }

        const nextRound = (game.roundNumber ?? 0) + 1;
        const now2 = new Date();
        await prisma.game.update({
          where: { id: gameId },
          data: {
            state: "ROUND_NOMINATE",
            roundNumber: nextRound,
            povUserId: null,
            stateEndsAt: new Date(now2.getTime() + BOT_ROUND_MS),
          },
        });

        try {
          await assignFastingPov(gameId, { skipLock: true });
        } catch {}

        return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
      }

      await resolveFastingEviction(gameId);
      return { ok: true, advanced: "vote" as const };
    }

    return { ok: true, skipped: true as const, reason: "wrong_state" as const };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
