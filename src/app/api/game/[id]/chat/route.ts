import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  // must be active in the game
  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString().trim();
  if (text.length < 1 || text.length > 240) {
    return NextResponse.json({ error: "Message must be 1–240 chars." }, { status: 400 });
  }

  // 5s cooldown (based on last message time)
  const last = await prisma.gameMessage.findFirst({
    where: { gameId, userId, channel: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const diff = Date.now() - last.createdAt.getTime();
    if (diff < 5000) {
      const left = Math.ceil((5000 - diff) / 1000);
      return NextResponse.json({ error: `Cooldown (${left}s)` }, { status: 429 });
    }
  }

  await prisma.gameMessage.create({
    data: { gameId, userId, channel: "PUBLIC", body: text },
  });

  await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId } },
    data: { chatCount: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
