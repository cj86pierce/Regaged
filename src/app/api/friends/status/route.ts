import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

/** GET /api/friends/status?userId=… — whether the viewer has friended that user */
export async function GET(req: Request) {
  const viewerId = await getCurrentUserId(req);
  if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === viewerId) {
    return NextResponse.json({ isFriend: false, canAddFriend: false });
  }

  const row = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: viewerId, friendId: userId } },
    select: { id: true },
  });
  const isFriend = !!row;
  return NextResponse.json({ isFriend, canAddFriend: !isFriend });
}
