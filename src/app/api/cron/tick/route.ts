import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

export async function POST(req: Request) {
  const now = new Date();

  // 1) Always ensure POV exists for active nomination rounds
  const nominateNeedingPov = await prisma.game.findMany({
    where: {
      gameType: "FASTING",
      state: "ROUND_NOMINATE",
      povUserId: null,
    },
    select: { id: true },
  });

  for (const g of nominateNeedingPov) {
    try {
      await assignFastingPov(g.id, false);
    } catch {
      // ignore POV errors for now; game might be invalid / edge case
    }
  }

  // 2) Resolve games whose phase timer has expired
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
        // Ensure POV exists, then resolve nominations -> moves to ROUND_VOTE
        await assignFastingPov(g.id, false);
        const r = await resolveFastingNominations(g.id);
        results.push({ gameId: g.id, action: "resolveNoms", result: r });
      } else if (g.state === "ROUND_VOTE") {
        const r = await resolveFastingEviction(g.id);
        results.push({ gameId: g.id, action: "resolveVote", result: r });
      }
    } catch (e: any) {
      results.push({ gameId: g.id, error: e?.message ?? "Failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    ensuredPov: nominateNeedingPov.length,
    processedDue: due.length,
    results,
  });
}
