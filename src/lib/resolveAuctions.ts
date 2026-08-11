/**
 * Resolve ended auctions: charge winner, pay seller 50%, set soldAt.
 * If the seller is the high bidder (opening 5R$ bid, nobody else bid), they keep it free.
 */
import { prisma } from "@/lib/prisma";

export async function resolveEndedAuctions(): Promise<{ resolved: number }> {
  const now = new Date();

  const ended = await prisma.auction.findMany({
    where: {
      endsAt: { lt: now },
      soldAt: null,
    },
    include: {
      design: { select: { userId: true } },
    },
  });

  let resolved = 0;
  for (const a of ended) {
    const sellerId = a.design.userId;
    const winnerId = a.currentBidUserId ?? sellerId;
    const sellerWinsFree = winnerId === sellerId;
    const amount = Math.max(5, a.currentBid);
    const sellerPayout = sellerWinsFree ? 0 : Math.floor(amount / 2);

    try {
      await prisma.$transaction(async (tx) => {
        if (!sellerWinsFree) {
          await tx.user.update({
            where: { id: winnerId },
            data: { tMoney: { decrement: amount } },
          });
          await tx.user.update({
            where: { id: sellerId },
            data: { tMoney: { increment: sellerPayout } },
          });
        }

        await tx.auction.update({
          where: { id: a.id },
          data: {
            soldAt: now,
            currentBid: amount,
            currentBidUserId: winnerId,
          },
        });
      });

      try {
        await prisma.designOwner.create({
          data: { userId: winnerId, designId: a.designId },
        });
      } catch {
        // already owns (seller / prior purchase)
      }
      resolved++;
    } catch (e) {
      console.error("Auction resolution failed", { auctionId: a.id, err: String(e) });
    }
  }

  return { resolved };
}
