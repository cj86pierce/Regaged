import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import { checkBlockedContent } from "@/lib/contentFilter";

const hit = checkBlockedContent(text);
if (hit) return NextResponse.json({ error: "Message contains blocked language." }, { status: 400 });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = (body?.text ?? "").toString().trim();
  if (text.length < 1 || text.length > 240) {
    return NextResponse.json({ error: "Message must be 1–240 chars." }, { status: 400 });
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
