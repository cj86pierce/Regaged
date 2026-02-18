import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import { checkBlockedContent } from "@/lib/contentFilter";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const gameId = params.id;

  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString();

  if (text.trim().length < 1) return bad("Message required");
  if (text.length > 500) return bad("Message too long (max 500)");

  const hit = checkBlockedContent(text);
  if (hit) return bad("Message contains blocked language.", 400);

  const inGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true },
  });
  if (!inGame || inGame.status !== "ACTIVE") return bad("Not in this game", 403);

  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const msg = await tx.gameMessage.create({
      data: { gameId, userId, channel: "PUBLIC", body: text },
      select: { id: true, body: true, createdAt: true, userId: true },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { chatCount: { increment: 1 }, lastActiveAt: now },
    });

    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    return {
      id: msg.id,
      userId: msg.userId,
      username: u?.username ?? "you",
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
      plus: 0,
      minus: 0,
      myReaction: null as "PLUS" | "MINUS" | null,
      isSystem: false,
    };
  });

  await touchUser(userId);

  return NextResponse.json({ ok: true, message: created });
}
