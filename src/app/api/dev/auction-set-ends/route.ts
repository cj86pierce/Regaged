import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function setAuctionEnds(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const secret = url.searchParams.get("secret") ?? body?.secret;
  if (!process.env.DEV_SECRET || secret !== process.env.DEV_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = (url.searchParams.get("title") ?? body?.title ?? "leon").toString().toLowerCase();
  const minutes = Math.max(1, Math.min(60, Number(url.searchParams.get("minutes") ?? body?.minutes ?? 5) || 5));

  const now = new Date();
  const endsAt = new Date(now.getTime() + minutes * 60 * 1000);

  const auction = await prisma.auction.findFirst({
    where: {
      endsAt: { gte: now },
      soldAt: null,
      design: { title: { contains: title, mode: "insensitive" } },
    },
    include: { design: { select: { title: true } } },
  });

  if (!auction) {
    return NextResponse.json({ error: "No active auction found matching title", title }, { status: 404 });
  }

  await prisma.auction.update({
    where: { id: auction.id },
    data: { endsAt },
  });

  return NextResponse.json({
    ok: true,
    auctionId: auction.id,
    designTitle: auction.design.title,
    endsAt: endsAt.toISOString(),
    inMinutes: minutes,
  });
}

/**
 * GET or POST /api/dev/auction-set-ends?secret=YOUR_DEV_SECRET&title=leon&minutes=5
 * Sets the first active auction whose design title contains `title` to end in `minutes`.
 * Open the URL in your browser (GET) to trigger it.
 */
export async function GET(req: Request) {
  return setAuctionEnds(req);
}

export async function POST(req: Request) {
  return setAuctionEnds(req);
}
