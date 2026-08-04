import { prisma } from "@/lib/prisma";

/** Wiki payouts: 1st +100%, 2nd +30%, 3rd +20%, 4th +10%, 5th stake back, else 0 */
export function rookiesBetPayout(stake: number, place: number | null | undefined): number {
  if (place == null || place < 1) return 0;
  if (place === 1) return Math.floor(stake * 2);
  if (place === 2) return Math.floor(stake * 1.3);
  if (place === 3) return Math.floor(stake * 1.2);
  if (place === 4) return Math.floor(stake * 1.1);
  if (place === 5) return stake;
  return 0;
}

export async function settleRookiesBets(gameId: string) {
  const bets = await prisma.rookiesBet.findMany({
    where: { gameId, paidOutAt: null },
  });
  if (!bets.length) return;

  const places = await prisma.gamePlayer.findMany({
    where: { gameId, userId: { in: bets.map((b) => b.targetUserId) } },
    select: { userId: true, eliminatedPlace: true },
  });
  const placeByUser = new Map(places.map((p) => [p.userId, p.eliminatedPlace]));

  const now = new Date();
  for (const bet of bets) {
    const place = placeByUser.get(bet.targetUserId) ?? null;
    const payout = rookiesBetPayout(bet.amount, place);
    await prisma.$transaction(async (tx) => {
      await tx.rookiesBet.update({
        where: { id: bet.id },
        data: { paidOutAt: now, payoutAmount: payout },
      });
      if (payout > 0) {
        await tx.user.update({
          where: { id: bet.betterUserId },
          data: { tMoney: { increment: payout } },
        });
      }
    });
  }
}
