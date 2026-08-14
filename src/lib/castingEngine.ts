import { prisma } from "@/lib/prisma";
import { CASTING_SLOW_PRIZES, prizeForPlace } from "@/lib/gamePrizes";
import { getSystemUserId } from "@/lib/systemUser";

function checks(plus: number, minus: number) {
  return (plus ?? 0) - (minus ?? 0);
}

export async function finalizeCastingGame(gameId: string) {
  const now = new Date();
  const systemUserId = await getSystemUserId();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, completedAt: true },
  });
  if (!game) return;
  if (game.state === "COMPLETED" || game.completedAt) return;

  const skipPayout = game.gameType === "CASTING_BOT";

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

  // Final day: keys decide winners, then challenge score, then activity
  const ranked = [...actives].sort((a, b) => {
    const ak = a.keys ?? 0,
      bk = b.keys ?? 0;
    if (bk !== ak) return bk - ak;

    const as = a.castingDayMiniGameScore ?? 0;
    const bs = b.castingDayMiniGameScore ?? 0;
    if (bs !== as) return bs - as;

    const ac = checks(a.plusCount ?? 0, a.minusCount ?? 0);
    const bc = checks(b.plusCount ?? 0, b.minusCount ?? 0);
    if (bc !== ac) return bc - ac;

    return (b.chatCount ?? 0) - (a.chatCount ?? 0);
  });

  const finalized = await prisma.$transaction(async (tx) => {
    // Bail if another worker already finished the game.
    const stillOpen = await tx.game.updateMany({
      where: { id: gameId, state: { not: "COMPLETED" }, completedAt: null },
      data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
    });
    if (stillOpen.count === 0) return false;

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
          `1st — ${nameOf(ranked[0]?.userId ?? "?")}\n` +
          `2nd — ${nameOf(ranked[1]?.userId ?? "?")}\n` +
          `3rd — ${nameOf(ranked[2]?.userId ?? "?")}\n` +
          `4th — ${nameOf(ranked[3]?.userId ?? "?")}`,
      },
    });
    return true;
  });

  // payouts for places 1..13 only — skip bot games and skip if we didn't just finalize
  if (!skipPayout && finalized) {
    const { applyPlacementPayout, isGameBotFilled } = await import("@/lib/botFillPayout");
    const botFilled = await isGameBotFilled(gameId);
    const placements = await prisma.gamePlayer.findMany({
      where: { gameId },
      select: { userId: true, eliminatedPlace: true },
    });

    for (const p of placements) {
      const pay = prizeForPlace(CASTING_SLOW_PRIZES, p.eliminatedPlace ?? 999);
      if (!pay) continue;

      await applyPlacementPayout(p.userId, pay.karma, pay.tMoney, { botFilled });
    }
  }
}
