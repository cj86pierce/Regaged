import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

export async function tickDueFastings() {
  const now = new Date();

  // Advance any due FASTING / FROOKIES / ROOKIES games
  const due = await prisma.game.findMany({
    where: {
      gameType: { in: ["FASTING", "FROOKIES", "ROOKIES"] },
      state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      stateEndsAt: { not: null, lte: now },
    },
    select: { id: true, state: true, povUserId: true },
  });

  for (const g of due) {
    try {
      if (g.state === "ROUND_NOMINATE") {
        await assignFastingPov(g.id);
        await resolveFastingNominations(g.id);
      } else {
        await resolveFastingEviction(g.id);
      }
    } catch {
      // ignore so one bad game doesn't break tick
    }
  }

  // Ensure POV exists for nominate games (even if not due)
  const needPov = await prisma.game.findMany({
    where: { gameType: { in: ["FASTING", "FROOKIES", "ROOKIES"] }, state: "ROUND_NOMINATE", povUserId: null },
    select: { id: true },
  });

  for (const g of needPov) {
    try {
      await assignFastingPov(g.id);
    } catch {}
  }

  return { ticked: due.length, povChecked: needPov.length };
}
