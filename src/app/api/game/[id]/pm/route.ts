import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function requireEmailVerified(userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return !!me?.emailVerifiedAt;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;
  if (!meUserId) return bad("Unauthorized", 401);

  // ✅ email verification gate
  const okEmail = await requireEmailVerified(meUserId);
  if (!okEmail) {
    return NextResponse.json(
      { error: "Email verification required", redirect: "/profile/edit" },
      { status: 403 }
    );
  }

  const gameId = params.id;

  const url = new URL(req.url);
  const withUserId = (url.searchParams.get("with") ?? "").toString().trim();
  if (!withUserId) return bad("Missing ?with=userId");

  // must both be in this game (any status)
  const meInGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: meUserId } },
    select: { id: true },
  });
  if (!meInGame) return bad("Not in this game", 403);

  const themInGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: withUserId } },
    select: { id: true },
  });
  if (!themInGame) return bad("Recipient not in this game", 400);

  const msgs = await prisma.gamePmMessage.findMany({
    where: {
      gameId,
      OR: [
        { senderUserId: meUserId, recipientUserId: withUserId },
        { senderUserId: withUserId, recipientUserId: meUserId },
      ],
    },
    orderBy: { createdAt: "desc" }, // newest first
    take: 100,
    include: {
      sender: { select: { username: true } },
      recipient: { select: { username: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    withUserId,
    messages: msgs.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      senderUserId: m.senderUserId,
      senderUsername: m.sender.username,
      recipientUserId: m.recipientUserId,
      recipientUsername: m.recipient.username,
      body: m.body,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;
  if (!meUserId) return bad("Unauthorized", 401);

  // ✅ email verification gate
  const okEmail = await requireEmailVerified(meUserId);
  if (!okEmail) {
    return NextResponse.json(
      { error: "Email verification required", redirect: "/profile/edit" },
      { status: 403 }
    );
  }

  const gameId = params.id;

  const body = await req.json().catch(() => null);
  const toUserId = (body?.toUserId ?? "").toString().trim();
  const text = (body?.text ?? "").toString();

  if (!toUserId) return bad("toUserId required");
  if (toUserId === meUserId) return bad("Cannot PM yourself");
  if (text.trim().length < 1) return bad("Message required");
  if (text.length > 500) return bad("Message too long (max 500)");

  // must both be in this game
  const meInGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: meUserId } },
    select: { id: true },
  });
  if (!meInGame) return bad("Not in this game", 403);

  const themInGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: toUserId } },
    select: { id: true },
  });
  if (!themInGame) return bad("Recipient not in this game", 400);

  const msg = await prisma.gamePmMessage.create({
    data: {
      gameId,
      senderUserId: meUserId,
      recipientUserId: toUserId,
      body: text,
    },
    include: { sender: { select: { username: true } }, recipient: { select: { username: true } } },
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      createdAt: msg.createdAt,
      senderUserId: msg.senderUserId,
      senderUsername: msg.sender.username,
      recipientUserId: msg.recipientUserId,
      recipientUsername: msg.recipient.username,
      body: msg.body,
    },
  });
}
