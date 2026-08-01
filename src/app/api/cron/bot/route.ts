/**
 * Cron tick for bot games: advance rounds + trigger bot actions.
 * Handles FASTING_BOT and CASTING_BOT games.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { tryStartFastingBotGame, tryStartFastingStyleBotGame, tryStartCastingBotGame } from "@/lib/gameEngineBot";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { requireCronAuth } from "@/lib/cronAuth";

async function runBotTick() {
  const now = new Date();

  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_bot')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    // Start full ENROLLING bot games (safety net)
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

    // FASTING_BOT: advance games that are due or stuck (same logic as main tick)
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

    let fastingAdvanced = 0;
    for (const g of fastingBotDue) {
      try {
        const r = await advanceFastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) fastingAdvanced++;
      } catch (e) {
        console.error("FASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    // CASTING_BOT: Fasting-style day rolling
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

    let castingAdvanced = 0;
    for (const g of castingBotDue) {
      try {
        const r = await advanceCastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) castingAdvanced++;
      } catch (e) {
        console.error("CASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    try {
      await applyCastingsPeriodicDecay({ gameType: "CASTING_BOT" });
    } catch (e) {
      console.error("CASTING_BOT periodic decay failed", { err: String(e) });
    }

    const castingBotActive = await prisma.game.findMany({
      where: {
        gameType: "CASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      },
      select: { id: true },
      take: 50,
    });
    for (const g of castingBotActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING_BOT drops failed", { gameId: g.id, err: String(e) });
      }
    }

    return {
      fasting: { due: fastingBotDue.length, advanced: fastingAdvanced },
      casting: { due: castingBotDue.length, advanced: castingAdvanced },
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_bot'))`;
  }
}

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runBotTick();
  return NextResponse.json({ ok: true, bot: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runBotTick();
  return NextResponse.json({ ok: true, bot: r });
}
