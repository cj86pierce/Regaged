import { prisma } from "@/lib/prisma";
import { getCastingDayMs } from "@/lib/castingDayLength";

const CASTING_MAX = 20;

/**
 * Wiki: Day 1 has no nominees. Just set timer; resolveDay1 will expel 1 by algorithm at end.
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

  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_VOTE",
      roundNumber: 1,
      startsAt: now,
      castingDayStartedAt: now,
      stateEndsAt: new Date(now.getTime() + getCastingDayMs()),
    },
  });
}
