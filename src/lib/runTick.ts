import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { advanceCastingIfDue } from "@/lib/castingAdvance";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { tryStartFastingBotGame, tryStartFastingStyleBotGame, tryStartCastingBotGame } from "@/lib/gameEngineBot";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { createAuctionsFromDesigns } from "@/lib/createAuctionsFromDesigns";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";
import { tryStartSurvivorGame } from "@/lib/survivor/start";
import { advanceSurvivorIfDue } from "@/lib/survivor/advance";
import { fillGameWithBots } from "@/lib/botUsers";
import { SURVIVOR_MAX } from "@/lib/survivor/timing";

export type TickResult =
  | { skipped: true; reason: "locked" }
  | Record<string, unknown>;

const TICK_LOCK_STALE_MS = 5 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __regagedTickLock: { startedAt: number } | undefined;
  // eslint-disable-next-line no-var
  var __regagedLastAuctionTickAt: number | undefined;
}

const AUCTION_EVERY_MS = 5 * 60 * 1000;

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
    // Start full ENROLLING bot games (safety net)
    // -----------------------
    const enrollingBots = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING_BOT", "CASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT", "SURVIVOR_BOT"] },
        state: "ENROLLING",
      },
      select: { id: true, gameType: true, survivorIsMerge: true },
      take: 20,
    });
    for (const g of enrollingBots) {
      try {
        if (g.gameType === "FASTING_BOT") await tryStartFastingBotGame(g.id);
        else if (g.gameType === "FROOKIES_BOT" || g.gameType === "ROOKIES_BOT") await tryStartFastingStyleBotGame(g.id, g.gameType);
        else if (g.gameType === "SURVIVOR_BOT") {
          // Merge lobbies are auto-seated from tribal — never pad them to 20 (that made merge run forever).
          // Bot tribal seasons also end at merge, so merge ENROLLING bots should be rare.
          if (g.survivorIsMerge) {
            await tryStartSurvivorGame(g.id, "SURVIVOR_BOT");
          } else {
            await fillGameWithBots(g.id, SURVIVOR_MAX);
            await tryStartSurvivorGame(g.id, "SURVIVOR_BOT");
          }
        } else await tryStartCastingBotGame(g.id);
      } catch {}
    }

    // -----------------------
    // CASTING_BOT (Fasting-style day rolling)
    // -----------------------
    const castingBotDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 50,
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
        OR: [
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 50,
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
        OR: [
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 50,
    });

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
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 25,
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
    // Drops must run for all active Castings, not only games whose day timer is due
    const castingActiveForDrops = await prisma.game.findMany({
      where: {
        gameType: { in: ["CASTING", "CASTING_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      },
      select: { id: true, gameType: true },
      take: 50,
    });
    for (const g of castingActiveForDrops) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error(`${g.gameType} drops failed`, { gameId: g.id, err: String(e) });
      }
    }

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

    // -----------------------
    // SURVIVOR / SURVIVOR_BOT
    // -----------------------
    const survivorDue = await prisma.game.findMany({
      where: {
        gameType: { in: ["SURVIVOR", "SURVIVOR_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 30,
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
