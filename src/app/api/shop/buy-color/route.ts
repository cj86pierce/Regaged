import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isEmailVerified } from "@/lib/emailVerification";
import { TV_STAR_ID } from "@/lib/colorCatalog";

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isEmailVerified(userId))) {
    return NextResponse.json({ error: "Email verification required", redirect: "/profile/edit" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const colorId = Number(body?.colorId);
  if (!Number.isFinite(colorId)) return NextResponse.json({ error: "colorId required" }, { status: 400 });

  if (colorId === 0) return NextResponse.json({ error: "White is default" }, { status: 400 });
  if (colorId < 1 || colorId > TV_STAR_ID) {
    return NextResponse.json({ error: "Color level not found" }, { status: 404 });
  }

  const level = await prisma.colorLevel.findUnique({
    where: { id: colorId },
    select: { id: true, name: true, karmaNeeded: true, priceT: true },
  });
  if (!level) return NextResponse.json({ error: "Color level not found" }, { status: 404 });

  try {
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

      const owned = await tx.userColor.findMany({
        where: { userId, colorId: { lte: TV_STAR_ID } },
        select: { colorId: true },
      });
      let highest = 0;
      for (const o of owned) if (o.colorId > highest) highest = o.colorId;
      if (colorId !== highest + 1) throw new Error("Locked — buy levels in order");

      if (me2.karma < level.karmaNeeded) throw new Error("Not enough karma");
      if (level.priceT > 0 && me2.tMoney < level.priceT) throw new Error("Not enough R$");

      await tx.user.update({
        where: { id: userId },
        data: {
          ...(level.priceT > 0 ? { tMoney: { decrement: level.priceT } } : {}),
          equippedColorId: colorId,
        },
      });

      await tx.userColor.create({
        data: { userId, colorId },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Purchase failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, colorId: level.id, name: level.name });
}
