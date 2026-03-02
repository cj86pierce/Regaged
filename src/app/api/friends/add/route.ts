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
  const targetUsername = typeof body?.username === "string" ? body.username.trim() : "";
  if (!targetUsername) return bad("Username required", 400);

  const target = await prisma.user.findUnique({
    where: { usernameLower: targetUsername.toLowerCase() },
    select: { id: true, username: true },
  });
  if (!target) return bad("User not found", 404);
  if (target.id === userId) return bad("Cannot add yourself", 400);

  const existing = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: target.id } },
  });
  if (existing) return bad("Already friends", 400);

  await prisma.$transaction([
    prisma.friendship.create({ data: { userId, friendId: target.id } }),
    prisma.friendship.create({ data: { userId: target.id, friendId: userId } }),
  ]);

  return NextResponse.json({ ok: true, friend: { id: target.id, username: target.username } });
}
