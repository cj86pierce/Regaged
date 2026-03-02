import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();

  const auctions = await prisma.auction.findMany({
    where: {
      endsAt: {
        gte: now,
      },
    },
    include: {
      design: {
        include: {
          user: { select: { username: true } },
        },
      },
    },
    orderBy: { endsAt: "asc" },
    take: 50,
  });

  return NextResponse.json({
    auctions: auctions.map((a) => ({
      id: a.id,
      designId: a.designId,
      designTitle: a.design.title,
      designDescription: a.design.description,
      designAuthorUsername: a.design.user.username,
      endsAt: a.endsAt.toISOString(),
      currentBid: a.currentBid,
    })),
  });
}

