/**
 * Bot advance for FASTING_BOT / FROOKIES_BOT / ROOKIES_BOT.
 * Same rules as live modes; phase timers use BOT_ROUND_MS (~2 min).
 */
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { enterFastingFinal3, resolveFastingEviction, resolveFastingFinal3IfDue } from "@/lib/fastingVotes";
import { performBotActions } from "@/lib/botActions";
import { assignFrookiesHoh } from "@/lib/frookiesHoh";
import { assignFrookiesPov } from "@/lib/frookiesPov";
import { resolveFrookiesNominations } from "@/lib/frookiesNoms";
import { enterFrookiesJuryPhase, resolveFrookiesJuryVoteIfDue } from "@/lib/frookiesJury";
import { assignRookiesHoh } from "@/lib/rookiesHoh";
import { resolveRookiesNominations } from "@/lib/rookiesNoms";
import { resolveRookiesEviction } from "@/lib/rookiesVotes";
import {
  BOT_ROUND_MS,
  getFrookiesHohRenomMs,
  getFrookiesPovSaveMs,
  getRookiesDayMs,
} from "@/lib/fastingTiming";

const ROOKIES_DAY_7 = 7;

export async function advanceFastingBotIfDue(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" as const };

  try {
    const now = new Date();

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameType: true,
        state: true,
        roundNumber: true,
        stateEndsAt: true,
        povUserId: true,
        hohUserId: true,
        povSavedUserId: true,
        frookiesPhase: true,
      },
    });
    if (
      !game ||
      (game.gameType !== "FASTING_BOT" &&
        game.gameType !== "FROOKIES_BOT" &&
        game.gameType !== "ROOKIES_BOT")
    ) {
      return { ok: false, error: "not_fasting_bot" as const };
    }

    const due = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime();
    const stuck = !!game.stateEndsAt && game.stateEndsAt.getTime() <= now.getTime() - 15_000;
    const missingTimer =
      !game.stateEndsAt && (game.state === "ROUND_NOMINATE" || game.state === "ROUND_VOTE");
    if (!due && !stuck && !missingTimer) {
      return { ok: true, skipped: true as const, reason: "not_due" as const };
    }

    try {
      await performBotActions(gameId);
    } catch (e) {
      console.error("BOT actions failed", { gameId, err: String(e) });
    }

    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: {
        nomineeAUserId: true,
        nomineeBUserId: true,
        nomineeCUserId: true,
        evictedUserId: true,
      },
    });

    const isFrookiesBot = game.gameType === "FROOKIES_BOT";
    const isRookiesBot = game.gameType === "ROOKIES_BOT";
    const rookiesDayMs = getRookiesDayMs(true);

    if (isFrookiesBot && game.state === "JURY_VOTE") {
      const r = await resolveFrookiesJuryVoteIfDue(gameId);
      return {
        ok: r.ok,
        advanced: (r as { finished?: boolean }).finished ? ("jury_resolved" as const) : undefined,
        skipped: (r as { skipped?: boolean }).skipped,
      };
    }

    if (game.gameType === "FASTING_BOT" && game.state === "FINAL3") {
      const r = await resolveFastingFinal3IfDue(gameId);
      return {
        ok: r.ok,
        advanced: (r as { finished?: boolean }).finished ? ("final3" as const) : undefined,
        skipped: (r as { skipped?: boolean }).skipped,
      };
    }

    // -------------------------
    // FROOKIES_BOT — mirror live phase machine with bot timers
    // -------------------------
    if (isFrookiesBot) {
      if (game.state === "ROUND_NOMINATE") {
        const phase = game.frookiesPhase;

        if (phase === "POV_SAVE" && (due || stuck)) {
          const saved = game.povSavedUserId;
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
                  data: {
                    frookiesPhase: "HOH_RENOM",
                    povSavedUserId: null,
                    stateEndsAt: new Date(Date.now() + getFrookiesHohRenomMs(true)),
                  },
                }),
              ]);
              return { ok: true, advanced: "frookies_bot_pov_saved_nominee" as const };
            }
          }
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_VOTE",
              stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
              frookiesPhase: null,
              povSavedUserId: null,
            },
          });
          return { ok: true, advanced: "frookies_bot_to_vote" as const };
        }
        if (phase === "POV_SAVE") {
          return { ok: true, skipped: true as const, reason: "waiting_pov_save" as const };
        }

        if (phase === "HOH_RENOM") {
          if (!(due || stuck || missingTimer)) {
            return { ok: true, skipped: true as const, reason: "waiting_hoh_renom" as const };
          }
          const kept = rr?.nomineeAUserId;
          const immune = new Set(
            [game.hohUserId, game.povUserId, game.povSavedUserId, kept].filter(Boolean) as string[]
          );
          const pool = await prisma.gamePlayer.findMany({
            where: { gameId, status: "ACTIVE", userId: { notIn: [...immune] } },
            select: { userId: true },
          });
          const replacement =
            pool[Math.floor(Math.random() * Math.max(1, pool.length))]?.userId ?? rr?.nomineeBUserId;
          if (kept && replacement) {
            await prisma.$transaction([
              prisma.roundResult.update({
                where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
                data: { nomineeAUserId: kept, nomineeBUserId: replacement },
              }),
              prisma.game.update({
                where: { id: gameId },
                data: {
                  state: "ROUND_VOTE",
                  stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
                  frookiesPhase: null,
                },
              }),
            ]);
            return { ok: true, advanced: "frookies_bot_hoh_renom_timeout" as const };
          }
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_VOTE",
              stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
              frookiesPhase: null,
            },
          });
          return { ok: true, advanced: "frookies_bot_hoh_renom_to_vote" as const };
        }

        if (!game.hohUserId) {
          try {
            await assignFrookiesHoh(gameId, { random: false, skipLock: true });
          } catch {}
        }
        if (!game.povUserId) {
          const { pickMinigameForDay } = await import("@/lib/minigamePicker");
          const { sampleBotChallengeScore } = await import("@/lib/minigames/registry");
          const minigameId = pickMinigameForDay(gameId, game.roundNumber ?? 1);
          const actives = await prisma.gamePlayer.findMany({
            where: { gameId, status: "ACTIVE" },
            select: { userId: true },
          });
          for (const p of actives) {
            await prisma.gamePlayer.update({
              where: { gameId_userId: { gameId, userId: p.userId } },
              data: { castingDayMiniGameScore: sampleBotChallengeScore(minigameId) },
            });
          }
          try {
            await assignFrookiesPov(gameId, { skipLock: true });
          } catch {}
        }
        if (rr?.nomineeAUserId && rr?.nomineeBUserId && !phase) {
          await prisma.game.update({
            where: { id: gameId },
            data: {
              frookiesPhase: "POV_SAVE",
              stateEndsAt: new Date(Date.now() + getFrookiesPovSaveMs(true)),
            },
          });
          return { ok: true, fixed: "nominees_exist_pov_save" as const };
        }
        await resolveFrookiesNominations(gameId);
        return { ok: true, advanced: "frookies_bot_noms" as const };
      }

      if (game.state === "ROUND_VOTE") {
        if (rr?.evictedUserId) {
          const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
          if (activeCount <= 2) {
            await enterFrookiesJuryPhase(gameId);
            return { ok: true, fixed: "evicted_exists_forced_jury" as const };
          }
          const nextRound = (game.roundNumber ?? 0) + 1;
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: nextRound,
              povUserId: null,
              hohUserId: null,
              povSavedUserId: null,
              frookiesPhase: null,
              stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
            },
          });
          await prisma.gamePlayer.updateMany({
            where: { gameId, status: "ACTIVE" },
            data: { castingDayMiniGameScore: 0 },
          });
          try {
            await assignFrookiesHoh(gameId, { random: false, skipLock: true });
          } catch {}
          return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
        }
        await resolveFastingEviction(gameId, { skipLock: true });
        return { ok: true, advanced: "frookies_bot_vote" as const };
      }
    }

    // -------------------------
    // ROOKIES_BOT — mirror live Rookies with 2-min days
    // -------------------------
    if (isRookiesBot) {
      if (game.state === "ROUND_NOMINATE") {
        if (game.roundNumber === 1) {
          await prisma.game.update({
            where: { id: gameId },
            data: {
              roundNumber: 2,
              hohUserId: null,
              povUserId: null,
              stateEndsAt: new Date(now.getTime() + rookiesDayMs),
            },
          });
          try {
            await assignRookiesHoh(gameId, { random: false, skipLock: true });
          } catch {}
          try {
            await assignFastingPov(gameId, { skipLock: true });
          } catch {}
          await resolveRookiesNominations(gameId);
          return { ok: true, advanced: "rookies_bot_day1_to_day2" as const };
        }
        if (game.roundNumber >= ROOKIES_DAY_7) {
          await resolveRookiesNominations(gameId);
          return { ok: true, advanced: "rookies_bot_noms" as const };
        }
        if (rr?.nomineeAUserId && rr?.nomineeBUserId) {
          await prisma.game.update({
            where: { id: gameId },
            data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + rookiesDayMs) },
          });
          return { ok: true, fixed: "rookies_bot_nominees_to_vote" as const };
        }
        if (!game.hohUserId && game.roundNumber >= 2) {
          try {
            await assignRookiesHoh(gameId, { random: false, skipLock: true });
          } catch {}
        }
        if (!game.povUserId) {
          try {
            await assignFastingPov(gameId, { skipLock: true });
          } catch {}
        }
        await resolveRookiesNominations(gameId);
        return { ok: true, advanced: "rookies_bot_noms" as const };
      }

      if (game.state === "ROUND_VOTE") {
        if (rr?.evictedUserId) {
          const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
          if (activeCount <= 2) {
            await prisma.game.update({
              where: { id: gameId },
              data: {
                state: "COMPLETED",
                stateEndsAt: null,
                povUserId: null,
                hohUserId: null,
                completedAt: new Date(),
              },
            });
            return { ok: true, fixed: "rookies_bot_forced_complete" as const };
          }
          const nextRound = game.roundNumber + 1;
          await prisma.game.update({
            where: { id: gameId },
            data: {
              state: "ROUND_NOMINATE",
              roundNumber: nextRound,
              povUserId: null,
              hohUserId: null,
              stateEndsAt: new Date(now.getTime() + rookiesDayMs),
            },
          });
          if (nextRound < ROOKIES_DAY_7) {
            try {
              await assignRookiesHoh(gameId, { random: false, skipLock: true });
            } catch {}
            try {
              await assignFastingPov(gameId, { skipLock: true });
            } catch {}
          }
          return { ok: true, fixed: "rookies_bot_forced_next_round" as const };
        }
        await resolveRookiesEviction(gameId, { skipLock: true });
        return { ok: true, advanced: "rookies_bot_vote" as const };
      }
    }

    // -------------------------
    // FASTING_BOT
    // -------------------------
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
          await enterFastingFinal3(gameId, game.gameType);
          return { ok: true, fixed: "evicted_exists_forced_final3" as const };
        }
        const nextRound = (game.roundNumber ?? 0) + 1;
        await prisma.game.update({
          where: { id: gameId },
          data: {
            state: "ROUND_NOMINATE",
            roundNumber: nextRound,
            povUserId: null,
            stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
          },
        });
        try {
          await assignFastingPov(gameId, { skipLock: true });
        } catch {}
        return { ok: true, fixed: "evicted_exists_forced_next_round" as const };
      }
      await resolveFastingEviction(gameId, { skipLock: true });
      return { ok: true, advanced: "vote" as const };
    }

    return { ok: true, skipped: true as const, reason: "wrong_state" as const };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
