import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

import { startCastingDay, resolveCastingDay } from "@/lib/castingEngine";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

async function runTick() {
  // ✅ global lock: prevents multiple ticks from running concurrently under load
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
    const due = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: new Date() },
      },
      select: { id: true, state: true },
      take: 25,
    });

    for (const g of due) {
      try {
        if (g.state === "ROUND_NOMINATE") {
          await assignFastingPov(g.id);
          await resolveFastingNominations(g.id);
        } else if (g.state === "ROUND_VOTE") {
          await resolveFastingEviction(g.id);
        }
      } catch {}
    }

    const needPov = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: "ROUND_NOMINATE",
        povUserId: null,
        stateEndsAt: { not: null },
      },
      select: { id: true },
      take: 25,
    });

    for (const g of needPov) {
      try {
        await assignFastingPov(g.id);
      } catch {}
    }

    // -----------------------
    // CASTING (day + voting + drops + decay)
    // NOTE: we’re temporarily using the existing enum states:
    // ROUND_NOMINATE = "day setup / nominees chosen"
    // ROUND_VOTE     = "voting open"
    // -----------------------
    const now = new Date();

    // 1) If CASTING voting window ended -> resolve day (evict + advance / finalize)
    const castingVoteDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_VOTE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingVoteDue) {
      try {
        // resolves evictions, sets placements, advances day, finalizes at 4
        await resolveCastingDay(g.id, g.roundNumber ?? 1);
      } catch {}
    }

    // 2) If CASTING day setup ended (ROUND_NOMINATE timer) -> start voting for next day
    const castingStartDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_NOMINATE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingStartDue) {
      try {
        const nextDay = (g.roundNumber ?? 1) + 1;

        // move into voting for the day
        await prisma.game.update({
          where: { id: g.id },
          data: {
            roundNumber: nextDay,
            state: "ROUND_VOTE",
            stateEndsAt: new Date(now.getTime() + CASTING_DAY_MS),
          },
        });

        // create nominees for that day
        await startCastingDay(g.id, nextDay);
      } catch {}
    }

    // 3) Drops run during both day setup + voting
    const castingActive = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      },
      select: { id: true },
      take: 25,
    });

    for (const g of castingActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch {}
    }

    // 4) Health decay runs during both states too
    try {
      await applyCastingHealthDecay();
    } catch {}

    return {
      fasting: { ticked: due.length, povChecked: needPov.length },
      casting: { voteResolved: castingVoteDue.length, dayStarted: castingStartDue.length, dropChecked: castingActive.length },
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_tick'))`;
  }
}

export async function GET() {
  if (process.env.CRON_DISABLED === "1") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const r = await runTick();
  return NextResponse.json({ ok: true, ...r });
}

export async function POST() {
  if (process.env.CRON_DISABLED === "1") {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const r = await runTick();
  return NextResponse.json({ ok: true, ...r });
}
