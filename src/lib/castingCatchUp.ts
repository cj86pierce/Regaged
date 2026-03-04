/**
 * Casting game catch-up logic (advance day when timer expired).
 * Used by cron and nudge route.
 */
import { prisma } from "@/lib/prisma";
import { ensureCastingVotingStarted, resolveCastingVoteDue } from "@/lib/castingDay";
import { getCastingDayMs } from "@/lib/castingDayLength";

export async function catchUpCastingGame(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true as const };

  try {
    let loops = 0;

    while (loops < 5) {
      loops++;

      const g = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, state: true, roundNumber: true, stateEndsAt: true },
      });
      if (!g) break;

      const now = new Date();
      if (!g.stateEndsAt) {
        await prisma.game.update({
          where: { id: gameId },
          data: { stateEndsAt: now },
        });
        continue;
      }
      const graceMs = 20000; // 20s grace for clock skew / cold starts
      if (g.stateEndsAt.getTime() > now.getTime() + graceMs) break;

      if (g.state === "ROUND_VOTE") {
        await resolveCastingVoteDue(gameId, g.roundNumber ?? 1);
        continue;
      }

      // Already at start of next day (e.g. after advanceToNextDay). Just start voting for this day.
      if (g.state === "ROUND_NOMINATE") {
        await ensureCastingVotingStarted(gameId, g.roundNumber ?? 1);
        continue;
      }

      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + getCastingDayMs()) },
      });
      break;
    }

    return { ok: true, loops };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
