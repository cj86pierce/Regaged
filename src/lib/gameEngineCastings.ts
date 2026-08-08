import { prisma } from "@/lib/prisma";
import { getCastingDayMs } from "@/lib/castingDayLength";
import { notifyGameStarted } from "@/lib/email/notifyGameStarted";

const CASTING_MAX = 20;

/**
 * Day 1 has no algorithmic nominees or eviction - only votes/health decay can
 * eliminate someone. Real nominate/vote days begin on day 2 (see castingVotes.ts).
 */
export async function tryStartCastingsGame(gameId: string) {
  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!g || g.gameType !== "CASTING" || g.state !== "ENROLLING") return;

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < CASTING_MAX) return;

  const now = new Date();

  // Day 1 = nominate/compete window (no nominees yet). Voting starts day 2+.
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      castingDayStartedAt: now,
      stateEndsAt: new Date(now.getTime() + getCastingDayMs()),
    },
  });

  void notifyGameStarted(gameId);
}
