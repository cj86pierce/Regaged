import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

if (process.env.CRON_DISABLED === "1") {
  return Response.json({ ok: true, disabled: true });
}

async function runTick() {
  // Advance games whose timers have expired
  const due = await prisma.game.findMany({
    where: {
      gameType: "FASTING",
      state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      stateEndsAt: { not: null, lte: new Date() },
    },
    select: { id: true, state: true },
  });

  for (const g of due) {
    try {
      if (g.state === "ROUND_NOMINATE") {
        // Ensure POV exists then resolve nominations
        await assignFastingPov(g.id);
        await resolveFastingNominations(g.id);
      } else if (g.state === "ROUND_VOTE") {
        await resolveFastingEviction(g.id);
      }
    } catch {
      // ignore errors so one bad game doesn't stop tick
    }
  }

  // Also ensure POV exists for nominate games (even if timer isn't due yet)
  const needPov = await prisma.game.findMany({
    where: {
      gameType: "FASTING",
      state: "ROUND_NOMINATE",
      povUserId: null,
    },
    select: { id: true },
  });

  for (const g of needPov) {
    try {
      await assignFastingPov(g.id);
    } catch {}
  }

  return { ticked: due.length, povChecked: needPov.length };
}

export async function GET() {
  const r = await runTick();
  return NextResponse.json({ ok: true, ...r });
}

export async function POST() {
  const r = await runTick();
  return NextResponse.json({ ok: true, ...r });
}
