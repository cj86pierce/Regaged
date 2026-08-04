import { prisma } from "@/lib/prisma";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Both tribes send the same number of competitors: min(|A|,|B|).
 * Extra players on the larger tribe sit out at random each challenge.
 */
export async function assignEqualSitOuts(gameId: string) {
  await prisma.gamePlayer.updateMany({
    where: { gameId },
    data: { sittingOut: false },
  });

  const [tribeA, tribeB] = await Promise.all([
    prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE", tribe: "A" },
      select: { userId: true },
    }),
    prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE", tribe: "B" },
      select: { userId: true },
    }),
  ]);

  const compete = Math.min(tribeA.length, tribeB.length);
  if (compete <= 0) return { compete: 0, sitOutIds: [] as string[] };

  const sitOutIds: string[] = [];
  if (tribeA.length > compete) {
    sitOutIds.push(...shuffle(tribeA.map((p) => p.userId)).slice(0, tribeA.length - compete));
  }
  if (tribeB.length > compete) {
    sitOutIds.push(...shuffle(tribeB.map((p) => p.userId)).slice(0, tribeB.length - compete));
  }

  if (sitOutIds.length) {
    await prisma.gamePlayer.updateMany({
      where: { gameId, userId: { in: sitOutIds } },
      data: { sittingOut: true },
    });
  }

  return { compete, sitOutIds };
}
