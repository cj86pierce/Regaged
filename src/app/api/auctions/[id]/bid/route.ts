import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = typeof body?.amount === "number" ? Math.floor(body.amount) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
  }

  const now = new Date();

  const auction = await prisma.auction.findUnique({
    where: { id: params.id },
    select: { id: true, currentBid: true, endsAt: true },
  });
  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.endsAt.getTime() <= now.getTime()) {
    return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
  }
  if (amount <= auction.currentBid) {
    return NextResponse.json({ error: "Bid must be higher than current bid" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id: auction.id },
      data: {
        currentBid: amount,
        currentBidUserId: userId,
      },
    });

    await tx.auctionBid.create({
      data: {
        auctionId: auction.id,
        userId,
        amount,
      },
    });
  });

  return NextResponse.json({ ok: true, currentBid: amount });
}

