import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";


async function runTick() {
  // ✅ global lock: prevents multiple ticks from running concurrently under load
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_tick')) as locked
  `;
  if (!lockRows?.[0]?.locked) {
    return { skipped: true, reason: "locked" as const };
  }

  try {
    // Advance games whose timers have expired
    const due = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: new Date() },
      },
      select: { id: true, state: true },
      take: 25, // ✅ safety cap per tick
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

    // ✅ Lightweight POV ensure: only check a few at a time
    const needPov = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: "ROUND_NOMINATE",
        povUserId: null,
        // only bother if game actually has an end timer set (active round)
        stateEndsAt: { not: null },
      },
      select: { id: true },
      take: 25, // ✅ cap
    });

    for (const g of needPov) {
      try {
        await assignFastingPov(g.id);
      } catch {}
    }

    return { ticked: due.length, povChecked: needPov.length };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_tick'))`;
  }
}

export async function GET() {
  // ✅ kill switch must be inside handler
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

// ✅ CASTING: spawn drops (no voting yet)
const castingGames = await prisma.game.findMany({
  where: { gameType: "CASTING", state: "ROUND_NOMINATE" }, // (temporary state name)
  select: { id: true },
  take: 25,
});

for (const g of castingGames) {
  try {
    await maybeSpawnCastingsDrops(g.id);
  } catch {}
  try {
  await applyCastingHealthDecay();
} catch {}

}
