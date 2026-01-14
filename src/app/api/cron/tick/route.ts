import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

export async function POST() {
  // Find games that need a tick (time ended)
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
        // ensure POV exists (one-arg call now)
        await assignFastingPov(g.id);
        await resolveFastingNominations(g.id);
      } else if (g.state === "ROUND_VOTE") {
        await resolveFastingEviction(g.id);
      }
    } catch {
      // ignore tick errors
    }
  }

  // Also assign POV for nominate games missing it (not due yet)
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
      await assignFastingPov(g.id); // ✅ one arg
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true, ticked: due.length, povChecked: needPov.length });
}
