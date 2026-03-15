import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { resolveRookiesNominations } from "@/lib/rookiesNoms";
import { resolveRookiesEviction } from "@/lib/rookiesVotes";

const NOM_PHASE_MS = 3 * 60 * 1000;
const VOTE_PHASE_MS = 2 * 60 * 1000;
const ROOKIES_DAY_MS = 24 * 60 * 60 * 1000;
const ROOKIES_DAY_7 = 7;

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
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true, hohUserId: true },
    });
    if (!game || (game.gameType !== "FASTING" && game.gameType !== "FROOKIES" && game.gameType !== "ROOKIES")) return { ok: false, error: "not_fasting" as const };

    // Only advance if due, clearly stuck, or stateEndsAt missing (unstick)
    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000; // 15s grace
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    // Read round result (if exists) for recovery
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, nomineeCUserId: true, evictedUserId: true },
    });

    const isRookies = game.gameType === "ROOKIES";

    // -------------------------
    // ROOKIES: 7 days, 24h, HOH + 3 nominees + ranking vote
    // -------------------------
    if (isRookies) {
      if (game.state === "ROUND_NOMINATE") {
        if (game.roundNumber === 1) {
          await prisma.game.update({
            where: { id: gameId },
            data: {
              roundNumber: 2,
              hohUserId: null,
              povUserId: null,
              stateEndsAt: new Date(now.getTime() + ROOKIES_DAY_MS),
            },
          });
          try { await assignRookiesHoh(gameId, { random: false, skipLock: true }); } catch {}
          try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
          await resolveRookiesNominations(gameId);
          return { ok: true, advanced: "rookies_day1_to_day2" as const };
        }
        if (game.roundNumber >= ROOKIES_DAY_7) {
          await resolveRookiesNominations(gameId);
          return { ok: true, advanced: "rookies_noms" as const };
        }
        if (rr?.nomineeAUserId && rr?.nomineeBUserId) {
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + ROOKIES_DAY_MS) },
          });
          return { ok: true, fixed: "rookies_nominees_exist_moved_to_vote" as const };
        }
        if (!game.hohUserId && game.roundNumber >= 2) {
          try { await assignRookiesHoh(gameId, { random: false, skipLock: true }); } catch {}
        }
        if (!game.povUserId) {
          try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
        }
        await resolveRookiesNominations(gameId);
        return { ok: true, advanced: "rookies_noms" as const };
      }
      if (game.state === "ROUND_VOTE") {
        if (rr?.evictedUserId) {
          const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
          if (activeCount <= 2) {
            await prisma.game.update({
              where: { id: gameId },
              data: { state: "COMPLETED", stateEndsAt: null, povUserId: null, hohUserId: null, completedAt: new Date() },
            });
            return { ok: true, fixed: "rookies_evicted_forced_complete" as const };
          }
          const nextRound = game.roundNumber + 1;
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: nextRound,
              povUserId: null,
              hohUserId: null,
              stateEndsAt: new Date(now.getTime() + ROOKIES_DAY_MS),
            },
          });
          if (nextRound < ROOKIES_DAY_7) {
            try { await assignRookiesHoh(gameId, { random: false, skipLock: true }); } catch {}
            try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
          }
          return { ok: true, fixed: "rookies_evicted_forced_next_round" as const };
        }
        await resolveRookiesEviction(gameId);
        return { ok: true, advanced: "rookies_vote" as const };
      }
    }

    // -------------------------
    // FASTING / FROOKIES: state machine with recovery
    // -------------------------

    if (game.state === "ROUND_NOMINATE") {
      if (!game.povUserId) {
        try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
      }

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
