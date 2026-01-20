import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";
import { startCastingDay, resolveCastingDayIfDue } from "@/lib/castingDay";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

async function runTick() {
  // global lock
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    const now = new Date();

    // -----------------------
    // FASTING (UNCHANGED behavior)
    // -----------------------
    const due = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
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
    // CASTING (ROUND_NOMINATE = “day running”, ROUND_VOTE = “voting”)
    // -----------------------

    // A) If a CASTING game is in ROUND_VOTE and its timer ended, resolve voting (evict) + advance day
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
        await resolveCastingDayIfDue(g.id, g.roundNumber ?? 1);
      } catch {}
    }

    // B) If a CASTING game is in ROUND_NOMINATE and its timer ended, start next day and immediately begin voting
    const castingNominateDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_NOMINATE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingNominateDue) {
      // per-game lock prevents double day roll
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
            state: "ROUND_NOMINATE",
            stateEndsAt: new Date(now.getTime() + CASTING_DAY_MS),
          },
        });

        // Immediately create nominees and switch to ROUND_VOTE for this day
        await startCastingDay(g.id, nextDay);
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${g.id}))`;
      }
    }

    // C) Safety: if CASTING is in ROUND_NOMINATE but has no nominees yet for today, start voting
    const castingNeedStart = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: "ROUND_NOMINATE",
        stateEndsAt: { not: null },
      },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingNeedStart) {
      try {
        await startCastingDay(g.id, g.roundNumber ?? 1);
      } catch {}
    }

    // D) Drops in both CASTING states
    const castingActive = await prisma.game.findMany({
      where: { gameType: "CASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] } },
      select: { id: true },
      take: 25,
    });

    for (const g of castingActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch {}
    }

    // E) Decay in both CASTING states (function filters internally)
    try {
      await applyCastingHealthDecay();
    } catch {}

    return {
      fasting: { ticked: due.length, povChecked: needPov.length },
      casting: { voteDue: castingVoteDue.length, startDue: castingNominateDue.length, active: castingActive.length },
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
