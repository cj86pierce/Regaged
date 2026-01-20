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

  const game = await prisma.game.findUnique({
    where: { id: msg.gameId },
    select: { gameType: true },
  });
  if (!game) return bad("Game not found", 404);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: msg.gameId, userId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in game", 403);

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_reactorUserId: { messageId, reactorUserId: userId } },
  });
  if (existing) return bad("You already reacted to this message.", 400);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // create reaction
    await tx.messageReaction.create({ data: { messageId, reactorUserId: userId, type } });

    // reactor becomes active
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId: msg.gameId, userId } },
      data: { lastActiveAt: now },
    });

    // update receiver plus/minus counts (received)
    const receiver = await tx.gamePlayer.update({
      where: { gameId_userId: { gameId: msg.gameId, userId: msg.userId } },
      data: type === "PLUS" ? { plusCount: { increment: 1 } } : { minusCount: { increment: 1 } },
      select: { plusCount: true, health: true },
    });

    // ✅ CASTING health gain on PLUS only
    if (game.gameType === "CASTING" && type === "PLUS") {
      // 1) receiver gains +1 HP every 3 PLUS received
      const newPlusReceived = receiver.plusCount ?? 0;
      if (newPlusReceived % 3 === 0) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId: msg.gameId, userId: msg.userId } },
          data: { health: Math.min(100, (receiver.health ?? 70) + 1) },
        });
      }

      // 2) giver gains +1 HP every 3 PLUS given (count via reactions)
      const givenCount = await tx.messageReaction.count({
        where: {
          reactorUserId: userId,
          type: "PLUS",
          message: { gameId: msg.gameId },
        },
      });

      if (givenCount % 3 === 0) {
        const giver = await tx.gamePlayer.findUnique({
          where: { gameId_userId: { gameId: msg.gameId, userId } },
          select: { health: true },
        });

        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId: msg.gameId, userId } },
          data: { health: Math.min(100, (giver?.health ?? 70) + 1) },
        });
      }
    }
  });

  await touchUser(userId);

  return NextResponse.json({ ok: true });
}
