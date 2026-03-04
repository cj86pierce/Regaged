/**
 * Casting game catch-up logic (advance day when timer expired).
 * Used by cron and nudge route.
 * forceDue: when true (e.g. manual nudge button), treat ROUND_VOTE as due even if timer not past.
 */
import { prisma } from "@/lib/prisma";
import { ensureCastingVotingStarted, resolveCastingVoteDue, resolveDay1 } from "@/lib/castingDay";
import { getCastingDayMs } from "@/lib/castingDayLength";

export async function catchUpCastingGame(gameId: string, options?: { forceDue?: boolean }) {
  const forceDue = options?.forceDue === true;

  const run = async () => {
    let loops = 0;

    while (loops < 5) {
      loops++;

      const g = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, state: true, roundNumber: true, stateEndsAt: true },
      });
      if (!g) break;

      const now = new Date();

      // ROUND_NOMINATE = start of a new day; always start voting for this day (no timer check).
      // This ensures we never get stuck in NOMINATE if ensureCastingVotingStarted failed in advanceToNextDay.
      if (g.state === "ROUND_NOMINATE") {
        await ensureCastingVotingStarted(gameId, g.roundNumber ?? 1);
        continue;
      }

      if (!g.stateEndsAt) {
        await prisma.game.update({
          where: { id: gameId },
          data: { stateEndsAt: now },
        });
        continue;
      }
      if (!forceDue) {
        const graceMs = 20000;
        if (g.stateEndsAt.getTime() > now.getTime() + graceMs) break;
      }

      if (g.state === "ROUND_VOTE") {
        const day = g.roundNumber ?? 1;
        if (day === 1) {
          await resolveDay1(gameId);
        } else {
          await resolveCastingVoteDue(gameId, day, { forceDue });
        }
        continue;
      }

      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + getCastingDayMs()) },
      });
      break;
    }

    return { ok: true, loops };
  };

  if (!forceDue) {
    const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
    `;
    if (!lockRows?.[0]?.locked) return { skipped: true as const };
    try {
      return await run();
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
    }
  }
  return await run();
}
