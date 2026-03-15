import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEndedAuctions } from "@/lib/resolveAuctions";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();

  await resolveEndedAuctions();

  const [auctions, soldAuctions] = await Promise.all([
    prisma.auction.findMany({
      where: { endsAt: { gte: now } },
      include: {
        design: {
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { endsAt: "asc" },
      take: 50,
    }),
    prisma.auction.findMany({
      where: { soldAt: { not: null } },
      select: {
        id: true,
        designId: true,
        endsAt: true,
        currentBid: true,
        currentBidUserId: true,
        design: {
          select: {
            title: true,
            description: true,
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { soldAt: "desc" },
      take: 10,
    }),
  ]);

  const mapAuction = (a: { id: string; designId: string; design: { title: string; description: string; user: { username: string } }; endsAt: Date; currentBid: number }) => ({
    id: a.id,
    designId: a.designId,
    designTitle: a.design.title,
    designDescription: a.design.description,
    designAuthorUsername: a.design.user.username,
    endsAt: a.endsAt.toISOString(),
    currentBid: a.currentBid,
  });

  const mapSoldAuction = (
    a: { id: string; designId: string; design: { title: string; description: string; user: { username: string } }; endsAt: Date; currentBid: number; currentBidUserId: string | null }
  ) => ({
    ...mapAuction(a),
    winnerUserId: a.currentBidUserId ?? null,
  });

  const res = NextResponse.json({
    auctions: auctions.map(mapAuction),
    soldAuctions: soldAuctions.map(mapSoldAuction),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

