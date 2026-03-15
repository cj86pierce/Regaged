import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { runCastingsDayChangeIfDue } from "@/lib/castingsDayChange";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { tryStartFastingBotGame, tryStartFastingStyleBotGame, tryStartCastingBotGame } from "@/lib/gameEngineBot";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { createAuctionsFromDesigns } from "@/lib/createAuctionsFromDesigns";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";

export type TickResult =
  | { skipped: true; reason: "locked" }
  | Record<string, unknown>;

/**
 * Run the main game tick: advance fasting/casting rounds, bot games, auctions, etc.
 * Uses a global DB advisory lock so only one tick runs at a time (safe with internal + HTTP triggers).
 */
export async function runTick(): Promise<TickResult> {
  const now = new Date();

  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" };

  try {
    // -----------------------
    // Start full ENROLLING bot games (safety net)
    // -----------------------
    const enrollingBots = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING_BOT", "CASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT"] },
        state: "ENROLLING",
      },
      select: { id: true, gameType: true },
      take: 20,
    });
    for (const g of enrollingBots) {
      try {
        if (g.gameType === "FASTING_BOT") await tryStartFastingBotGame(g.id);
        else if (g.gameType === "FROOKIES_BOT" || g.gameType === "ROOKIES_BOT") await tryStartFastingStyleBotGame(g.id, g.gameType);
        else await tryStartCastingBotGame(g.id);
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
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
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
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
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
    // CASTING (12h day system: nominees from mini game, vote, health decay)
    // -----------------------
    const castingDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_VOTE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 25,
    });

    let castingAdvanced = 0;
    for (const g of castingDue) {
      try {
        const r = await runCastingsDayChangeIfDue(g.id);
        if (r.ok && ((r as any).advanced || (r as any).finished)) castingAdvanced++;
      } catch (e) {
        console.error("CASTING day change failed", { gameId: g.id, err: String(e) });
      }
    }
    for (const g of castingDue) {
      try { await maybeSpawnCastingsDrops(g.id); } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }
    for (const g of castingBotDue) {
      try { await maybeSpawnCastingsDrops(g.id); } catch (e) {
        console.error("CASTING_BOT drops failed", { gameId: g.id, err: String(e) });
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

    const result: Record<string, unknown> = {
      fasting: { due: fastingDue.length, advanced: fastingAdvanced },
      fastingBot: { due: fastingBotDue.length, advanced: fastingBotAdvanced },
      castingBot: { due: castingBotDue.length, advanced: castingBotAdvanced },
      casting: { due: castingDue.length, advanced: castingAdvanced },
    };

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

    return result;
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_tick'))`;
  }
}
