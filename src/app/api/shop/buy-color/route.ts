import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const colorId = Number(body?.colorId);
  if (!Number.isFinite(colorId)) return NextResponse.json({ error: "colorId required" }, { status: 400 });

  const level = await prisma.colorLevel.findUnique({
    where: { id: colorId },
    select: { id: true, name: true, karmaNeeded: true, priceT: true },
  });
  if (!level) return NextResponse.json({ error: "Color level not found" }, { status: 404 });

  const already = await prisma.userColor.findUnique({
    where: { userId_colorId: { userId, colorId } },
    select: { id: true },
  });
  if (already) return NextResponse.json({ error: "Already owned" }, { status: 409 });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { karma: true, tMoney: true },
  });
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (me.karma < level.karmaNeeded) return NextResponse.json({ error: "Not enough Karma" }, { status: 400 });
  if (me.tMoney < level.priceT) return NextResponse.json({ error: "Not enough T$" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // re-check inside transaction
    const me2 = await tx.user.findUnique({ where: { id: userId }, select: { tMoney: true, karma: true } });
    if (!me2) throw new Error("User not found");
    if (me2.karma < level.karmaNeeded) throw new Error("Not enough Karma");
    if (me2.tMoney < level.priceT) throw new Error("Not enough T$");

    await tx.user.update({
      where: { id: userId },
      data: { tMoney: { decrement: level.priceT } },
    });

    await tx.userColor.create({
      data: { userId, colorId },
    });
  });

  return NextResponse.json({ ok: true, colorId, name: level.name });
}
