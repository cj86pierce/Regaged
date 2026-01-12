import { prisma } from "@/lib/prisma";

const FASTING_NOM_MS = 2 * 60 * 1000; // 2 minutes

export async function tryStartFastingGame() {
  const enrollments = await prisma.enrollment.findMany({
    where: { gameType: "FASTING" },
    orderBy: { createdAt: "asc" },
    take: 15,
  });

  if (enrollments.length < 15) return;

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
