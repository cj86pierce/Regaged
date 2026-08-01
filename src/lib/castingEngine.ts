import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

// CASTING SLOW payouts (Karma = “K”)
const CASTING_SLOW_PAYOUT: Record<number, { karma: number; tMoney: number }> = {
  1: { karma: 80000, tMoney: 50 },
  2: { karma: 40000, tMoney: 25 },
  3: { karma: 20000, tMoney: 15 },
  4: { karma: 10000, tMoney: 12 },
  5: { karma: 8000, tMoney: 10 },
  6: { karma: 6000, tMoney: 8 },
  7: { karma: 5000, tMoney: 7 },
  8: { karma: 4000, tMoney: 6 },
  9: { karma: 3000, tMoney: 5 },
  10: { karma: 2000, tMoney: 4 },
  11: { karma: 1000, tMoney: 3 },
  12: { karma: 0, tMoney: 2 },
  13: { karma: 0, tMoney: 2 },
  // 14–20: 0/0
};

function checks(plus: number, minus: number) {
  return (plus ?? 0) - (minus ?? 0);
}

export async function finalizeCastingGame(gameId: string) {
  const now = new Date();
  const systemUserId = await getSystemUserId();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true },
  });
  const skipPayout = game?.gameType === "CASTING_BOT";

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: {
      userId: true,
      keys: true,
      plusCount: true,
      minusCount: true,
      castingDayMiniGameScore: true,
      chatCount: true,
    },
  });

  // FAQ final day: activity/checkmarks, challenge scores, and keys
  const ranked = [...actives].sort((a, b) => {
    const ac = checks(a.plusCount ?? 0, a.minusCount ?? 0);
    const bc = checks(b.plusCount ?? 0, b.minusCount ?? 0);
    if (bc !== ac) return bc - ac;

    const as = a.castingDayMiniGameScore ?? 0;
    const bs = b.castingDayMiniGameScore ?? 0;
    if (bs !== as) return bs - as;

    const ak = a.keys ?? 0, bk = b.keys ?? 0;
    if (bk !== ak) return bk - ak;

    return (b.chatCount ?? 0) - (a.chatCount ?? 0);
  });

  await prisma.$transaction(async (tx) => {
    // stamp 1..4 and eliminate them (game completed)
    for (let i = 0; i < ranked.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: ranked[i].userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: i + 1,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
    });

    const users = await tx.user.findMany({
      where: { id: { in: ranked.map((r) => r.userId) } },
      select: { id: true, username: true },
    });
    const nameOf = (id: string) => users.find((x) => x.id === id)?.username ?? id;

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body:
          `[SYSTEM] Castings finished!\n` +
          `- 1st: ${nameOf(ranked[0]?.userId ?? "?")}\n` +
          `- 2nd: ${nameOf(ranked[1]?.userId ?? "?")}\n` +
          `- 3rd: ${nameOf(ranked[2]?.userId ?? "?")}\n` +
          `- 4th: ${nameOf(ranked[3]?.userId ?? "?")}`,
      },
    });
  });

  // payouts for places 1..13 only - block for CASTING_BOT
  if (!skipPayout) {
    const placements = await prisma.gamePlayer.findMany({
      where: { gameId },
      select: { userId: true, eliminatedPlace: true },
    });

    for (const p of placements) {
      const place = p.eliminatedPlace ?? 999;
      const pay = CASTING_SLOW_PAYOUT[place];
      if (!pay) continue;

      await prisma.user.update({
        where: { id: p.userId },
        data: {
          karma: { increment: pay.karma },
          tMoney: { increment: pay.tMoney },
        },
      });
    }
  }
}
