import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// FASTING
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

// CASTING
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

async function runTick() {
  const now = new Date();

  // ✅ global lock: prevents multiple ticks from running concurrently
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) {
    return { skipped: true, reason: "locked" as const };
  }

  try {
    // -----------------------
    // FASTING (unchanged)
    // -----------------------
    const fastingDue = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, state: true },
      take: 25,
    });

    for (const g of fastingDue) {
      try {
        if (g.state === "ROUND_NOMINATE") {
          await assignFastingPov(g.id);
          await resolveFastingNominations(g.id);
        } else if (g.state === "ROUND_VOTE") {
          await resolveFastingEviction(g.id);
        }
      } catch {
        // ignore
      }
    }

    const fastingNeedPov = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: "ROUND_NOMINATE",
        povUserId: null,
        stateEndsAt: { not: null },
      },
      select: { id: true },
      take: 25,
    });

    for (const g of fastingNeedPov) {
      try {
        await assignFastingPov(g.id);
      } catch {}
    }

    // -----------------------
    // CASTING (fix stuck 00:00:00)
    // Castings advances ONLY by time (stateEndsAt), not by vote completion.
    // We keep state as ROUND_NOMINATE placeholder.
    // -----------------------

    // A) advance CASTING days whose timer expired
    const castingDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_NOMINATE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingDue) {
      // per-game lock prevents double-advance
      const lock = await prisma.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_lock(hashtext(${g.id})) as locked
      `;
      if (!lock?.[0]?.locked) continue;

      try {
        const nextDay = (g.roundNumber ?? 1) + 1;

        await prisma.game.update({
          where: { id: g.id },
          data: {
            roundNumber: nextDay,
            // ✅ critical: always move the timer forward
            stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
            // ✅ keep state the same for now (no enum changes)
            state: "ROUND_NOMINATE",
          },
        });

        // NOTE: nomination + voting resolution will be layered in later.
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${g.id}))`;
      }
    }

    // B) spawn drops for active CASTING games (in this placeholder state)
    const castingActive = await prisma.game.findMany({
      where: { gameType: "CASTING", state: "ROUND_NOMINATE" },
      select: { id: true },
      take: 25,
    });

    for (const g of castingActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch {}
    }

    // C) apply health decay (function should include CASTING state check internally)
    try {
      await applyCastingHealthDecay();
    } catch {}

    return {
      fasting: { ticked: fastingDue.length, povChecked: fastingNeedPov.length },
      casting: { dayAdvanced: castingDue.length, active: castingActive.length },
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_tick'))`;
  }
}

export async function GET() {
  if (process.env.CRON_DISABLED === "1") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  return NextResponse.json({ ok: true, ...(await runTick()) });
}

export async function POST() {
  if (process.env.CRON_DISABLED === "1") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  return NextResponse.json({ ok: true, ...(await runTick()) });
}
