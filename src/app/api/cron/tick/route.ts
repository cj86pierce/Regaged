import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { catchUpCastingBotGame } from "@/lib/castingBotEngine";

// CASTING pieces you already have
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";

async function runTick() {
  const now = new Date();

  // global lock
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    // -----------------------
    // FASTING: advance anything due (robust)
    // -----------------------
    const fastingDue = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
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
        gameType: "FASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
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

    const castingBotActive = await prisma.game.findMany({
      where: { gameType: "CASTING_BOT", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] } },
      select: { id: true },
      take: 50,
    });

    for (const g of castingBotActive) {
      try {
        await catchUpCastingBotGame(g.id);
      } catch (e) {
        console.error("CASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    // -----------------------
    // CASTING: keep your existing active behaviors
    // -----------------------
    const castingActive = await prisma.game.findMany({
      where: { gameType: "CASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] } },
      select: { id: true },
      take: 25,
    });

    for (const g of castingActive) {
      try { await maybeSpawnCastingsDrops(g.id); } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }

    try { await applyCastingHealthDecay(); } catch (e) {
      console.error("CASTING decay failed", { err: String(e) });
    }

    return {
      fasting: { due: fastingDue.length, advanced: fastingAdvanced },
      fastingBot: { due: fastingBotDue.length, advanced: fastingBotAdvanced },
      castingBot: { active: castingBotActive.length },
      casting: { active: castingActive.length },
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_tick'))`;
  }
}

export async function GET() {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  return NextResponse.json({ ok: true, ...(await runTick()) });
}

export async function POST() {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  return NextResponse.json({ ok: true, ...(await runTick()) });
}
