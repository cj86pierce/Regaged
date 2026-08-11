import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();

  await resolveEndedAuctions();

  const auctionInclude = {
    design: {
      include: { user: { select: { username: true } } },
    },
    currentBidUser: { select: { id: true, username: true } },
    bids: {
      orderBy: { createdAt: "desc" as const },
      take: 30,
      include: { user: { select: { username: true } } },
    },
  };

  const [live, sold] = await Promise.all([
    prisma.auction.findMany({
      where: { soldAt: null, endsAt: { gte: now } },
      include: auctionInclude,
      orderBy: { endsAt: "asc" },
      take: 50,
    }),
    prisma.auction.findMany({
      where: { soldAt: { not: null } },
      include: auctionInclude,
      orderBy: { soldAt: "desc" },
      take: 40,
    }),
  ]);

  const mapAuction = (a: (typeof live)[number], soldFlag: boolean) => ({
    id: a.id,
    designId: a.designId,
    designTitle: a.design.title,
    designDescription: a.design.description,
    designAuthorUsername: a.design.user.username,
    endsAt: a.endsAt.toISOString(),
    soldAt: a.soldAt ? a.soldAt.toISOString() : null,
    sold: soldFlag,
    currentBid: a.currentBid,
    currentBidUsername: a.currentBidUser?.username ?? null,
    winnerUserId: soldFlag ? a.currentBidUserId ?? null : null,
    winnerUsername: soldFlag ? a.currentBidUser?.username ?? null : null,
    bidHistory: a.bids.map((b) => ({
      username: b.user.username,
      amount: b.amount,
      createdAt: b.createdAt.toISOString(),
    })),
  });

  const auctions = live.map((a) => mapAuction(a, false));
  const soldAuctions = sold.map((a) => mapAuction(a, true));

  const res = NextResponse.json({
    auctions,
    soldAuctions,
    /** Combined feed: live first, then sold log */
    feed: [...auctions, ...soldAuctions],
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
