import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";
import { ensureCastingVotingStarted, resolveCastingVoteDue } from "@/lib/castingDay";

async function runTick() {
  const now = new Date();

  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    // FASTING
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
        } else {
          await resolveFastingEviction(g.id);
        }
      } catch {}
    }

    const needPov = await prisma.game.findMany({
      where: { gameType: "FASTING", state: "ROUND_NOMINATE", povUserId: null, stateEndsAt: { not: null } },
      select: { id: true },
      take: 25,
    });
    for (const g of needPov) {
      try {
        await assignFastingPov(g.id);
      } catch {}
    }

    // CASTING: resolve any voteDue games (this is what was missing)
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
    await resolveCastingVoteDue(g.id, g.roundNumber ?? 1);
  } catch (e) {
    console.error("CASTING resolveCastingVoteDue failed", {
      gameId: g.id,
      day: g.roundNumber,
      err: String(e),
    });
  }
}


    // CASTING: ensure voting is started (nominees exist) for current day
    const castingNeedStart = await prisma.game.findMany({
      where: { gameType: "CASTING", state: "ROUND_NOMINATE", stateEndsAt: { not: null } },
      select: { id: true, roundNumber: true },
      take: 25,
    });

    for (const g of castingNeedStart) {
  try {
    await ensureCastingVotingStarted(g.id, g.roundNumber ?? 1);
  } catch (e) {
    console.error("CASTING ensureCastingVotingStarted failed", {
      gameId: g.id,
      day: g.roundNumber,
      err: String(e),
    });
  }
}

    // CASTING drops in both states
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

    // CASTING decay in both states
    try {
      await applyCastingHealthDecay();
    } catch {}

    return {
      fasting: { ticked: due.length, povChecked: needPov.length },
      casting: { voteDue: castingVoteDue.length, startDue: castingNeedStart.length, active: castingActive.length },
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
