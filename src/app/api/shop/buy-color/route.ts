import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ phone verification gate (must be INSIDE the handler)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneVerifiedAt: true },
  });
  if (!me?.phoneVerifiedAt) {
    return NextResponse.json(
      { error: "Phone verification required", redirect: "/verify-phone" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const colorId = Number(body?.colorId);
  if (!Number.isFinite(colorId)) return NextResponse.json({ error: "colorId required" }, { status: 400 });

  // White is default and not buyable
  if (colorId === 0) return NextResponse.json({ error: "White is default" }, { status: 400 });

  const level = await prisma.colorLevel.findUnique({
    where: { id: colorId },
    select: { id: true, name: true, karmaNeeded: true, priceT: true },
  });
  if (!level) return NextResponse.json({ error: "Color level not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const already = await tx.userColor.findUnique({
      where: { userId_colorId: { userId, colorId } },
      select: { id: true },
    });
    if (already) throw new Error("Already owned");

    const me2 = await tx.user.findUnique({
      where: { id: userId },
      select: { karma: true, tMoney: true },
    });
    if (!me2) throw new Error("User not found");

    // enforce buy in order (treat white as owned)
    const owned = await tx.userColor.findMany({
      where: { userId },
      select: { colorId: true },
    });
    let highest = 0;
    for (const o of owned) if (o.colorId > highest) highest = o.colorId;
    const nextBuyable = highest + 1;
    if (colorId !== nextBuyable) throw new Error("Locked — buy levels in order");

    if (me2.karma < level.karmaNeeded) throw new Error("Not enough karma");
    if (me2.tMoney < level.priceT) throw new Error("Not enough T$");

    await tx.user.update({
      where: { id: userId },
      data: { tMoney: { decrement: level.priceT } },
    });

    await tx.userColor.create({
      data: { userId, colorId },
    });
  });

  return NextResponse.json({ ok: true, colorId: level.id, name: level.name });
}
