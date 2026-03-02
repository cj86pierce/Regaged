import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const friendId = typeof body?.friendId === "string" ? body.friendId : "";
  if (!friendId) return bad("friendId required", 400);

  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { userId, friendId } }),
    prisma.friendship.deleteMany({ where: { userId: friendId, friendId: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
