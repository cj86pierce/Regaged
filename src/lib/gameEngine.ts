import { prisma } from "@/lib/prisma";

const FASTING_MAX_PLAYERS = 15;
const FASTING_NOM_MS = 2 * 60 * 1000; // 2 minutes

export async function tryStartFastingGame() {
  // Grab earliest 15 enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: { gameType: "FASTING" },
    orderBy: { createdAt: "asc" },
    take: FASTING_MAX_PLAYERS,
  });

  // Only start when FULL
  if (enrollments.length < FASTING_MAX_PLAYERS) return;

  const game = await prisma.game.create({
    data: {
      gameType: "FASTING",
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: new Date(),
      stateEndsAt: new Date(Date.now() + FASTING_NOM_MS),
    },
    select: { id: true },
  });

  await prisma.gamePlayer.createMany({
    data: enrollments.map((e) => ({ gameId: game.id, userId: e.userId })),
  });

  await prisma.enrollment.deleteMany({
    where: { id: { in: enrollments.map((e) => e.id) } },
  });
}
