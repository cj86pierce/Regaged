import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { advanceCastingIfDue } from "@/lib/castingAdvance";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { maybeSpawnCastingsDrops, pruneAllActiveCastingDrops } from "@/lib/castingsDrops";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { createAuctionsFromDesigns } from "@/lib/createAuctionsFromDesigns";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";
import { advanceSurvivorIfDue } from "@/lib/survivor/advance";
import { healBadSurvivorMerges } from "@/lib/survivor/repair";
import { maybeStartEnrollingLobby } from "@/lib/lobbyTiming";
import { performBotActions } from "@/lib/botActions";

export type TickResult =
  | { skipped: true; reason: "locked" }
  | Record<string, unknown>;

const TICK_LOCK_STALE_MS = 5 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __regagedTickLock: { startedAt: number } | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastAuctionTickAt: number | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastBotActionsAt: number | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastCastingDecayAt: number | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastCastingDropsAt: number | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastSurvivorHealAt: number | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastCastingDropPruneAt: number | undefined;
}

const AUCTION_EVERY_MS = 5 * 60 * 1000;
const BOT_ACTIONS_EVERY_MS = 60_000;
const CASTING_DECAY_EVERY_MS = 5 * 60 * 1000;
const CASTING_DROPS_EVERY_MS = 60_000;
const SURVIVOR_HEAL_EVERY_MS = 5 * 60 * 1000;
const CASTING_DROP_PRUNE_EVERY_MS = 2 * 60 * 1000;

/**
 * Run the main game tick: advance fasting/casting rounds, bot games, auctions, etc.
 * Uses an in-process guard so local page pings cannot overlap.
 * Avoid DB session advisory locks here: Supabase poolers can keep those locks stuck
 * when lock/unlock land on different backend connections.
 */
export async function runTick(): Promise<TickResult> {
  const now = new Date();

  const startedAt = Date.now();
  const currentLock = globalThis.__regagedTickLock;
  if (currentLock && startedAt - currentLock.startedAt < TICK_LOCK_STALE_MS) {
    return { skipped: true, reason: "locked" };
  }
  const lock = { startedAt };
  globalThis.__regagedTickLock = lock;

  try {
    // -----------------------
    // All ENROLLING lobbies: 15m wait, then start (bots fill empty seats)
    // -----------------------
    const enrollingLobbies = await prisma.game.findMany({
      where: {
        gameType: {
          in: [
            "FASTING",
            "CASTING",
            "FROOKIES",
            "ROOKIES",
            "SURVIVOR",
            "FASTING_BOT",
            "CASTING_BOT",
            "FROOKIES_BOT",
            "ROOKIES_BOT",
            "SURVIVOR_BOT",
          ],
        },
        state: "ENROLLING",
      },
      select: { id: true },
      take: 60,
    });
    let lobbiesStarted = 0;
    for (const g of enrollingLobbies) {
      try {
        const r = await maybeStartEnrollingLobby(g.id);
        if (r.ok && ("filled" in r || "started" in r || "attempted" in r)) lobbiesStarted++;
      } catch {}
    }

    // Mid-phase bot chatter/votes — at most once a minute (advance path still acts when due)
    let botActionsGames = 0;
    const lastBotActionsAt = globalThis.__regagedLastBotActionsAt ?? 0;
    if (Date.now() - lastBotActionsAt >= BOT_ACTIONS_EVERY_MS) {
      globalThis.__regagedLastBotActionsAt = Date.now();
      const activeBotGames = await prisma.game.findMany({
        where: {
          gameType: { in: ["FASTING_BOT", "CASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT", "SURVIVOR_BOT"] },
          state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE"] },
        },
        select: { id: true },
        take: 15,
      });
      botActionsGames = activeBotGames.length;
      for (const g of activeBotGames) {
        try {
          await performBotActions(g.id);
        } catch {}
      }
    }

    // -----------------------
    // CASTING_BOT (Fasting-style day rolling)
    // -----------------------
    const castingBotDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 20,
    });

    let castingBotAdvanced = 0;
    for (const g of castingBotDue) {
      try {
        const r = await advanceCastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) castingBotAdvanced++;
      } catch (e) {
        console.error("CASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    // -----------------------
    // FASTING: advance anything due (robust)
    // -----------------------
    const fastingDue = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING", "FROOKIES", "ROOKIES"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 20,
    });

    let fastingAdvanced = 0;
    for (const g of fastingDue) {
      try {
        const r = await advanceFastingIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) fastingAdvanced++;
      } catch (e) {
        console.error("FASTING advance failed", { gameId: g.id, err: String(e) });
      }
    }

    // -----------------------
    // FASTING_BOT / CASTING_BOT
    // -----------------------
    const fastingBotDue = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 20,
    });

    // Repair missing timers without treating them as "always due"
    const fastingBotMissingTimer = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: null,
      },
      select: { id: true },
      take: 5,
    });
    for (const g of fastingBotMissingTimer) {
      try {
        await prisma.game.update({
          where: { id: g.id },
          data: { stateEndsAt: new Date(Date.now() + 30_000) },
        });
      } catch {}
    }

    let fastingBotAdvanced = 0;
    for (const g of fastingBotDue) {
      try {
        const r = await advanceFastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) fastingBotAdvanced++;
      } catch (e) {
        console.error("FASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    // -----------------------
    // CASTING (12h day system: nominees from mini game/checks/keys, vote, health decay)
    // -----------------------
    const castingDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [
          { stateEndsAt: { lte: now } },
          { stateEndsAt: null },
          // Heal: day 2+ must never linger in compete-only nominate
          { state: "ROUND_NOMINATE", roundNumber: { gte: 2 } },
        ],
      },
      select: { id: true },
      take: 15,
    });

    let castingAdvanced = 0;
    for (const g of castingDue) {
      try {
        const r = await advanceCastingIfDue(g.id);
        if (r.ok && ((r as any).advanced || (r as any).fixed)) castingAdvanced++;
      } catch (e) {
        console.error("CASTING advance failed", { gameId: g.id, err: String(e) });
      }
    }

    const lastDropPruneAt = globalThis.__regagedLastCastingDropPruneAt ?? 0;
    if (Date.now() - lastDropPruneAt >= CASTING_DROP_PRUNE_EVERY_MS) {
      globalThis.__regagedLastCastingDropPruneAt = Date.now();
      try {
        await pruneAllActiveCastingDrops();
      } catch (e) {
        console.error("CASTING drop prune failed", { err: String(e) });
      }
    }

    const lastDropsAt = globalThis.__regagedLastCastingDropsAt ?? 0;
    if (Date.now() - lastDropsAt >= CASTING_DROPS_EVERY_MS) {
      globalThis.__regagedLastCastingDropsAt = Date.now();
      const castingActiveForDrops = await prisma.game.findMany({
        where: {
          gameType: { in: ["CASTING", "CASTING_BOT"] },
          state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        },
        select: { id: true, gameType: true },
        take: 20,
      });
      for (const g of castingActiveForDrops) {
        try {
          await maybeSpawnCastingsDrops(g.id);
        } catch (e) {
          console.error(`${g.gameType} drops failed`, { gameId: g.id, err: String(e) });
        }
      }
    }

    const lastDecayAt = globalThis.__regagedLastCastingDecayAt ?? 0;
    if (Date.now() - lastDecayAt >= CASTING_DECAY_EVERY_MS) {
      globalThis.__regagedLastCastingDecayAt = Date.now();
      try {
        await applyCastingsPeriodicDecay({ gameType: "CASTING" });
      } catch (e) {
        console.error("CASTING periodic decay failed", { err: String(e) });
      }
      try {
        await applyCastingsPeriodicDecay({ gameType: "CASTING_BOT" });
      } catch (e) {
        console.error("CASTING_BOT periodic decay failed", { err: String(e) });
      }
    }

    // -----------------------
    // SURVIVOR / SURVIVOR_BOT
    // -----------------------
    const lastSurvivorHealAt = globalThis.__regagedLastSurvivorHealAt ?? 0;
    if (Date.now() - lastSurvivorHealAt >= SURVIVOR_HEAL_EVERY_MS) {
      globalThis.__regagedLastSurvivorHealAt = Date.now();
      try {
        await healBadSurvivorMerges();
      } catch (e) {
        console.error("Survivor merge heal failed", { err: String(e) });
      }
    }

    const survivorDue = await prisma.game.findMany({
      where: {
        gameType: { in: ["SURVIVOR", "SURVIVOR_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 15,
    });
    let survivorAdvanced = 0;
    for (const g of survivorDue) {
      try {
        const r = await advanceSurvivorIfDue(g.id);
        if ((r as { advanced?: boolean; fixed?: boolean }).advanced || (r as { fixed?: boolean }).fixed) {
          survivorAdvanced++;
        }
      } catch (e) {
        console.error("SURVIVOR advance failed", { gameId: g.id, err: String(e) });
      }
    }

    const result: Record<string, unknown> = {
      fasting: { due: fastingDue.length, advanced: fastingAdvanced },
      fastingBot: { due: fastingBotDue.length, advanced: fastingBotAdvanced },
      castingBot: { due: castingBotDue.length, advanced: castingBotAdvanced },
      casting: { due: castingDue.length, advanced: castingAdvanced },
      survivor: { due: survivorDue.length, advanced: survivorAdvanced },
      lobbiesStarted,
      botActionsGames,
    };

    // Auctions don't need to run every 15s — throttle to every 5 minutes.
    const lastAuctionAt = globalThis.__regagedLastAuctionTickAt ?? 0;
    if (Date.now() - lastAuctionAt >= AUCTION_EVERY_MS) {
      globalThis.__regagedLastAuctionTickAt = Date.now();
      try {
        const { created } = await createAuctionsFromDesigns();
        if (created > 0) result.auctionsCreated = created;
      } catch (e) {
        console.error("Auction creation failed", { err: String(e) });
      }
      try {
        const { resolved } = await resolveEndedAuctions();
        if (resolved > 0) result.auctionsResolved = resolved;
      } catch (e) {
        console.error("Auction resolution failed", { err: String(e) });
      }
    }

    return result;
  } finally {
    if (globalThis.__regagedTickLock === lock) {
      globalThis.__regagedTickLock = undefined;
    }
  }
}
