import { prisma } from "@/lib/prisma";

const CASTING_MAX = 20;
const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

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
      stateEndsAt: new Date(now.getTime() + CASTING_DAY_MS),
    },
  });
}
