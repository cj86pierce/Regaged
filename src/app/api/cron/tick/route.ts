import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { advanceCastingIfDue } from "@/lib/castingAdvance";
import { runCastingsDayChangeIfDue } from "@/lib/castingsDayChange";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { tryStartFastingBotGame, tryStartFastingStyleBotGame, tryStartCastingBotGame } from "@/lib/gameEngineBot";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { createAuctionsFromDesigns } from "@/lib/createAuctionsFromDesigns";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";

async function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  if (req.headers.get("x-vercel-cron") === "1") return null;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  if (auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret) return null;
  // Allow authenticated users to trigger tick (keeps games advancing when user has any page open)
  const userId = await getCurrentUserId(req);
  if (userId) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function runTick() {
  const now = new Date();

  // Only process active games (ROUND_NOMINATE, ROUND_VOTE). ENROLLING and COMPLETED are skipped.

  // global lock
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

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

    // Day-end decay is inside runCastingsDayChangeIfDue.
    // applyCastingHealthDecay only runs for legacy/stuck games if needed.

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

async function handleTick(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  try {
    const result = await runTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Cron tick failed", e);
    return NextResponse.json(
      { ok: false, error: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleTick(req);
}

export async function POST(req: Request) {
  return handleTick(req);
}
