import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { enterFastingFinal3, resolveFastingEviction, resolveFastingFinal3IfDue } from "@/lib/fastingVotes";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { resolveRookiesNominations } from "@/lib/rookiesNoms";
import { resolveRookiesEviction } from "@/lib/rookiesVotes";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";
import { assignFrookiesPov } from "@/lib/frookiesPov";
import { resolveFrookiesNominations } from "@/lib/frookiesNoms";
import { enterFrookiesJuryPhase, resolveFrookiesJuryVoteIfDue } from "@/lib/frookiesJury";
import { getFastingNomMs, getFastingVoteMs } from "@/lib/fastingTiming";

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
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true, hohUserId: true, povSavedUserId: true, frookiesPhase: true },
    });
    if (!game || (game.gameType !== "FASTING" && game.gameType !== "FROOKIES" && game.gameType !== "ROOKIES")) return { ok: false, error: "not_fasting" as const };

    if (game.state === "FINAL3") {
      const r = await resolveFastingFinal3IfDue(gameId);
      return { ok: r.ok, advanced: (r as any).finished ? ("final3" as const) : undefined, skipped: (r as any).skipped };
    }

    // Only advance if due, clearly stuck, or stateEndsAt missing (unstick)
    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000; // 15s grace
    const missingTimer = !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!due && !stuck && !missingTimer) return { ok: true, skipped: true as const, reason: "not_due" as const };

    const NOM_PHASE_MS = getFastingNomMs();
    const VOTE_PHASE_MS = getFastingVoteMs();

    // Read round result (if exists) for recovery
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true, nomineeCUserId: true, evictedUserId: true },
    });

    const isRookies = game.gameType === "ROOKIES";
    const isFrookies = game.gameType === "FROOKIES";

    // -------------------------
    // FROOKIES: Casting-style competition (highest score = POV), POV save, then HOH nominates 2
    // -------------------------
    if (isFrookies) {
      if (game.state === "JURY_VOTE") {
        const r = await resolveFrookiesJuryVoteIfDue(gameId);
        return { ok: r.ok, advanced: (r as any).finished ? ("jury_resolved" as const) : undefined, skipped: (r as any).skipped };
      }
      if (game.state === "ROUND_NOMINATE") {
        const phase = (game as { frookiesPhase?: string | null }).frookiesPhase;

        if (phase === "POV_SAVE" && (due || stuck)) {
          const saved = (game as { povSavedUserId?: string | null }).povSavedUserId;
          const nomA = rr?.nomineeAUserId;
          const nomB = rr?.nomineeBUserId;
          if (saved && nomA && nomB) {
            const savedIsNominee = saved === nomA || saved === nomB;
            if (savedIsNominee) {
              const other = saved === nomA ? nomB : nomA;
              await prisma.$transaction([
                prisma.roundResult.update({
                  where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
                  data: { nomineeAUserId: other, nomineeBUserId: saved },
                }),
                prisma.game.update({
                  where: { id: gameId },
                  data: { frookiesPhase: "HOH_RENOM", povSavedUserId: null, stateEndsAt: new Date(Date.now() + 60_000) },
                }),
              ]);
              return { ok: true, advanced: "frookies_pov_saved_nominee" as const };
            }
          }
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_VOTE",
              stateEndsAt: new Date(Date.now() + VOTE_PHASE_MS),
              frookiesPhase: null,
              povSavedUserId: null,
            },
          });
          return { ok: true, advanced: "frookies_to_vote" as const };
        }
        if (phase === "POV_SAVE") return { ok: true, skipped: true as const, reason: "waiting_pov_save" as const };

        if (phase === "HOH_RENOM") {
          return { ok: true, skipped: true as const, reason: "waiting_hoh_renom" as const };
        }

        if (!game.hohUserId) {
          try { await assignFrookiesHoh(gameId, { random: false, skipLock: true }); } catch {}
        }
        if (!game.povUserId) {
          try { await assignFrookiesPov(gameId, { skipLock: true }); } catch {}
          const after = await prisma.game.findUnique({ where: { id: gameId }, select: { povUserId: true } });
          if (!after?.povUserId) {
            try { await assignFastingPov(gameId, { skipLock: true }); } catch {}
          }
        }
        if (rr?.nomineeAUserId && rr?.nomineeBUserId && !phase) {
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + VOTE_PHASE_MS), frookiesPhase: null },
          });
          return { ok: true, fixed: "nominees_exist_moved_to_vote" as const };
        }
        await resolveFrookiesNominations(gameId);
        return { ok: true, advanced: "frookies_noms" as const };
      }
      if (game.state === "ROUND_VOTE") {
        if (rr?.evictedUserId) {
          const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
          if (activeCount <= 2) {
            await enterFrookiesJuryPhase(gameId);
            return { ok: true, fixed: "evicted_exists_forced_jury" as const };
          }
          const nextRound = game.roundNumber + 1;
          const now2 = new Date();
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: nextRound,
              povUserId: null,
              hohUserId: null,
              povSavedUserId: null,
              frookiesPhase: null,
              stateEndsAt: new Date(now2.getTime() + NOM_PHASE_MS),
            },
          });
          await prisma.gamePlayer.updateMany({
            where: { gameId, status: "ACTIVE" },
            data: { castingDayMiniGameScore: 0 },
          });
          try { await assignFrookiesHoh(gameId, { random: false, skipLock: true }); } catch {}
          return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
        }
        await resolveFastingEviction(gameId);
        return { ok: true, advanced: "frookies_vote" as const };
      }
    }

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
    // FASTING: state machine with recovery
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
          await enterFastingFinal3(gameId, game.gameType);
          return { ok: true, fixed: "evicted_exists_forced_final3" as const };
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
