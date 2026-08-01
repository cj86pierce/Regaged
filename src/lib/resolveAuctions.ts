/**
 * Resolve ended auctions: charge winner, pay seller 50%, set soldAt.
 */
import { prisma } from "@/lib/prisma";

export async function resolveEndedAuctions(): Promise<{ resolved: number }> {
  const now = new Date();

  const ended = await prisma.auction.findMany({
    where: {
      endsAt: { lt: now },
      soldAt: null,
      currentBidUserId: { not: null },
      currentBid: { gte: 5 },
    },
    include: {
      design: { select: { userId: true } },
    },
  });

  let resolved = 0;
  for (const a of ended) {
    const winnerId = a.currentBidUserId!;
    const sellerId = a.design.userId;
    const amount = a.currentBid;
    const sellerPayout = Math.floor(amount / 2);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: winnerId },
          data: { tMoney: { decrement: amount } },
        });
        await tx.user.update({
          where: { id: sellerId },
          data: { tMoney: { increment: sellerPayout } },
        });
        await tx.auction.update({
          where: { id: a.id },
          data: { soldAt: now },
        });
      });
      try {
        await prisma.designOwner.create({
          data: { userId: winnerId, designId: a.designId },
        });
      } catch {
        console.warn("DesignOwner create skipped (table may not exist)", { auctionId: a.id });
      }
      resolved++;
    } catch (e) {
      console.error("Auction resolution failed", { auctionId: a.id, err: String(e) });
    }
  }

  return { resolved };
}
