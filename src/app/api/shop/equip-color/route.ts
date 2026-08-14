import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const colorId = Number(body?.colorId);
  if (!Number.isFinite(colorId)) return NextResponse.json({ error: "colorId required" }, { status: 400 });

  if (colorId === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { equippedColorId: 0 },
    });
    return NextResponse.json({ ok: true, colorId: 0 });
  }

  const owned = await prisma.userColor.findUnique({
    where: { userId_colorId: { userId, colorId } },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "You don't own that color" }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: { equippedColorId: colorId },
  });
  return NextResponse.json({ ok: true, colorId });
}
