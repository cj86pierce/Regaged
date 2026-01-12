import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { isSystemUser } from "@/lib/systemUser";
import { touchUser } from "@/lib/touchUser";

export async function POST(req: Request, { params }: { params: { messageId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messageId = params.messageId;
  const body = await req.json().catch(() => null);
  const type = body?.type as "PLUS" | "MINUS";
  if (type !== "PLUS" && type !== "MINUS") return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });

  const msg = await prisma.gameMessage.findUnique({
    where: { id: messageId },
    select: { id: true, gameId: true, userId: true, channel: true },
  });
  if (!msg || msg.channel !== "PUBLIC") return NextResponse.json({ error: "Message not found" }, { status: 404 });

  if (msg.userId === userId) return NextResponse.json({ error: "You cannot react to your own message." }, { status: 400 });
  if (await isSystemUser(msg.userId)) return NextResponse.json({ error: "You cannot react to system messages." }, { status: 400 });

  const gp = await prisma.gamePlayer.findUnique({ where: { gameId_userId: { gameId: msg.gameId, userId } } });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_reactorUserId: { messageId, reactorUserId: userId } },
  });
  if (existing) return NextResponse.json({ error: "You already reacted to this message." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.messageReaction.create({ data: { messageId, reactorUserId: userId, type } });
    await tx.gamePlayer.update({ where: { gameId_userId: { gameId: msg.gameId, userId } }, data: { lastActiveAt: new Date() } });
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId: msg.gameId, userId: msg.userId } },
      data: type === "PLUS" ? { plusCount: { increment: 1 } } : { minusCount: { increment: 1 } },
    });
  });

  await touchUser(userId);

  return NextResponse.json({ ok: true });
}
