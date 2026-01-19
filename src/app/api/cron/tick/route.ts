import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

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
      } catch {
        // ignore single-game errors
      }
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
    // CASTING (day roll + drops + decay)
    // Temporary: CASTING uses state=ROUND_NOMINATE until we add a real enum
    // -----------------------
    const now = new Date();

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
      // per-game lock to prevent double-advance
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
            stateEndsAt: new Date(now.getTime() + CASTING_DAY_MS),
            // later: reset daily counters here (healthGainedToday, plusGivenToday, etc.)
          },
        });

        // Optional: system message that a new day began (comment out if you don’t want spam)
        // const systemUserId = await getSystemUserId();
        // await prisma.gameMessage.create({
        //   data: { gameId: g.id, userId: systemUserId, channel: "PUBLIC", body: `[SYSTEM] Day ${nextDay} has begun.` },
        // });
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${g.id}))`;
      }
    }

    // B) spawn drops for active CASTING games
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

    // C) apply health decay once per tick (function handles all casting games)
    try {
      await applyCastingHealthDecay();
    } catch {}

    return {
      fasting: { ticked: due.length, povChecked: needPov.length },
      casting: { dayAdvanced: castingDue.length, dropChecked: castingActive.length },
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
