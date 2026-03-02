import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

const NOM_PHASE_MS = 3 * 60 * 1000;  // your current values
const VOTE_PHASE_MS = 2 * 60 * 1000;

export async function advanceFastingIfDue(gameId: string) {
  // Lock per game so concurrent ticks/requests can't double-advance
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
    if (!game || game.gameType !== "FASTING") return { ok: false, error: "not_fasting" as const };

    // Only advance if due, clearly stuck, or stateEndsAt missing (unstick)
    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000; // 15s grace
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    // Read round result (if exists) for recovery
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
    });

    // -------------------------
    // State machine with recovery
    // -------------------------

    if (game.state === "ROUND_NOMINATE") {
      // Ensure POV exists before nominations
      if (!game.povUserId) {
        try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
      }

      // If nominees already exist but game didn't move to vote, fix it
      if (rr?.nomineeAUserId && rr?.nomineeBUserId) {
        await prisma.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + VOTE_PHASE_MS) },
        });
        return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
      }

      // Otherwise run normal nomination resolver
      await resolveFastingNominations(gameId);
      return { ok: true, advanced: "noms" as const };
    }

    if (game.state === "ROUND_VOTE") {
      // If eviction already happened but state didn't advance, fix it
      if (rr?.evictedUserId) {
        // If game should already be completed, leave it
        const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

        if (activeCount <= 3) {
          // resolveFastingEviction() would normally finish; if we’re here, finish might have failed
          // safest: force stateEndsAt null and state COMPLETED if not already
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "COMPLETED", stateEndsAt: null, povUserId: null, completedAt: new Date() },
          });
          return { ok: true, fixed: "evicted_exists_forced_complete" as const };
        }

        // Otherwise force next round
        const nextRound = (game.roundNumber ?? 0) + 1;
        const now2 = new Date();
        await prisma.game.update({
          where: { id: gameId },
          data: {
            state: "ROUND_NOMINATE",
            roundNumber: nextRound,
            povUserId: null,
            stateEndsAt: new Date(now2.getTime() + NOM_PHASE_MS),
          },
        });

        // Assign POV immediately (best-effort)
        try { await assignFastingPov(gameId, { skipLock: true }); } catch {}

        return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
      }

      // Normal eviction resolve (also advances/finishes)
      await resolveFastingEviction(gameId);
      return { ok: true, advanced: "vote" as const };
    }

    // other states ignored
    return { ok: true, skipped: true as const, reason: "wrong_state" as const };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
