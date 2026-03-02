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
  const friendIds = Array.isArray(body?.friendIds) ? body.friendIds.filter((x: unknown) => typeof x === "string") : [];
  if (friendIds.length === 0) return bad("friendIds required", 400);

  // Verify all friendIds are actually the user's friends
  const mine = await prisma.friendship.findMany({
    where: { userId },
    select: { friendId: true },
  });
  const mineSet = new Set(mine.map((m) => m.friendId));
  if (friendIds.some((id: string) => !mineSet.has(id))) return bad("Invalid friend list", 400);

  await prisma.$transaction(
    friendIds.map((friendId: string, i: number) =>
      prisma.friendship.update({
        where: { userId_friendId: { userId, friendId } },
        data: { position: i },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
