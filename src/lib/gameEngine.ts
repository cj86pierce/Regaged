import { prisma } from "./prisma";

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
      stateEndsAt: new Date(Date.now() + 5 * 60 * 1000), // noms = 5 min
    },
  });

  for (const e of enrollments) {
    await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: e.userId,
      },
    });
  }

  await prisma.enrollment.deleteMany({
    where: { id: { in: enrollments.map(e => e.id) } },
  });

  console.log("🎮 Fasting game started:", game.id);
}
