import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { isSystemUser } from "@/lib/systemUser";
import { touchUser } from "@/lib/touchUser";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { messageId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return bad("Unauthorized", 401);

  const messageId = params.messageId;
  const body = await req.json().catch(() => null);
  const type = body?.type as "PLUS" | "MINUS";
  if (type !== "PLUS" && type !== "MINUS") return bad("Invalid reaction type", 400);

  const msg = await prisma.gameMessage.findUnique({
    where: { id: messageId },
    select: { id: true, gameId: true, userId: true, channel: true },
  });
  if (!msg || msg.channel !== "PUBLIC") return bad("Message not found", 404);

  if (msg.userId === userId) return bad("You cannot react to your own message.", 400);
  if (await isSystemUser(msg.userId)) return bad("You cannot react to system messages.", 400);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: msg.gameId, userId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in game", 403);

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_reactorUserId: { messageId, reactorUserId: userId } },
    select: { id: true },
  });
  if (existing) return bad("You already reacted to this message.", 400);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.messageReaction.create({
      data: { messageId, reactorUserId: userId, type },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId: msg.gameId, userId } },
      data: { lastActiveAt: now },
    });

    // Update receiver counts
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId: msg.gameId, userId: msg.userId } },
      data: type === "PLUS" ? { plusCount: { increment: 1 } } : { minusCount: { increment: 1 } },
    });

    // Return updated net counts for this message (fast: count only for this message)
    const counts = await tx.messageReaction.groupBy({
      by: ["type"],
      where: { messageId },
      _count: { _all: true },
    });

    const plus = counts.find((c) => c.type === "PLUS")?._count._all ?? 0;
    const minus = counts.find((c) => c.type === "MINUS")?._count._all ?? 0;

    return { messageId, plus, minus, myReaction: type };
  });

  await touchUser(userId);

  return NextResponse.json({ ok: true, ...result });
}
