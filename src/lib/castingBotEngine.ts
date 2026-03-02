/**
 * 60-second casting advance + bot actions for CASTING_BOT games.
 * Reuses castingDay with getDayMsForGame (returns 60s for CASTING_BOT).
 */
import { prisma } from "@/lib/prisma";
import { ensureCastingVotingStarted, resolveCastingVoteDue } from "@/lib/castingDay";
import { performBotActions } from "@/lib/botActions";
import { BOT_DAY_MS } from "@/lib/castingDayLength";

export async function catchUpCastingBotGame(gameId: string) {
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
        select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true },
      });
      if (!g || g.gameType !== "CASTING_BOT") break;

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

      // Trigger bot actions before advancing
      try {
        await performBotActions(gameId);
      } catch (e) {
        console.error("CASTING_BOT bot actions failed", { gameId, err: String(e) });
      }

      if (g.state === "ROUND_VOTE") {
        await resolveCastingVoteDue(gameId, g.roundNumber ?? 1);
        continue;
      }

      if (g.state === "ROUND_NOMINATE") {
        const nextDay = (g.roundNumber ?? 1) + 1;
        await prisma.game.update({
          where: { id: gameId },
          data: {
            roundNumber: nextDay,
            state: "ROUND_NOMINATE",
            stateEndsAt: new Date(Date.now() + BOT_DAY_MS),
          },
        });

        await ensureCastingVotingStarted(gameId, nextDay);
        continue;
      }

      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + BOT_DAY_MS) },
      });
      break;
    }

    return { ok: true, loops };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}
