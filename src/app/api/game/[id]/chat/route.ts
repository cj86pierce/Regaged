import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import { checkBlockedContent } from "@/lib/contentFilter";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString();

  if (text.trim().length < 1) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Message too long (max 500)" }, { status: 400 });
  }

  // ✅ content filter (INSIDE handler)
  const hit = checkBlockedContent(text);
  if (hit) {
    return NextResponse.json({ error: "Message contains blocked language." }, { status: 400 });
  }

  // must be in game to chat
  const inGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true },
  });
  if (!inGame || inGame.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not in this game" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.gameMessage.create({
      data: { gameId, userId, channel: "PUBLIC", body: text },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { chatCount: { increment: 1 }, lastActiveAt: new Date() },
    });
  });

  await touchUser(userId);

  return NextResponse.json({ ok: true });
}
