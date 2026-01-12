import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

// One global lock id for tick. Any number is fine, keep stable.
const TICK_LOCK_ID = 8675309;

async function runTick() {
  // ✅ prevent overlapping ticks (huge for Supabase pooler limits)
  const gotLock = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${TICK_LOCK_ID}) as locked
  `;
  if (!gotLock?.[0]?.locked) {
    return { ok: true, skipped: true, reason: "tick already running" };
  }

  try {
    const now = new Date();

    // Ensure POV exists for nomination rounds
    const needPov = await prisma.game.findMany({
      where: { gameType: "FASTING", state: "ROUND_NOMINATE", povUserId: null },
      select: { id: true },
    });

    for (const g of needPov) {
      try {
        await assignFastingPov(g.id, false);
      } catch {
        // ignore
      }
    }

    // Resolve expired phases
    const due = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true, state: true },
    });

    const results: any[] = [];

    for (const g of due) {
      try {
        if (g.state === "ROUND_NOMINATE") {
          await assignFastingPov(g.id, false);
          const r = await resolveFastingNominations(g.id);
          results.push({ gameId: g.id, action: "resolveNoms", result: r });
        } else {
          const r = await resolveFastingEviction(g.id);
          results.push({ gameId: g.id, action: "resolveVote", result: r });
        }
      } catch (e: any) {
        results.push({ gameId: g.id, error: e?.message ?? "Failed" });
      }
    }

    return { ok: true, ensuredPov: needPov.length, processedDue: due.length, results };
  } finally {
    // always release lock
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${TICK_LOCK_ID})`;
  }
}

export async function GET() {
  try {
    const out = await runTick();
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Tick failed" }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
