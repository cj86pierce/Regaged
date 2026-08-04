import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { checkBlockedContent } from "@/lib/contentFilter";
import { isEmailVerified } from "@/lib/emailVerification";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** GET: list conversations (users I've DMed with, with latest message) */
export async function GET(req: Request) {
  const meUserId = await getCurrentUserId(req);
  if (!meUserId) return bad("Unauthorized", 401);

  const okEmail = await isEmailVerified(meUserId);
  if (!okEmail) return NextResponse.json({ error: "Email verification required", redirect: "/profile/edit" }, { status: 403 });

  const all = await prisma.directMessage.findMany({
    where: {
      OR: [{ senderUserId: meUserId }, { recipientUserId: meUserId }],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { senderUserId: true, recipientUserId: true, body: true, createdAt: true, readAt: true },
  });

  const userIds = new Set<string>();
  const latestByUser = new Map<string, { body: string; createdAt: Date; isIncoming: boolean; unread: boolean }>();
  for (const m of all) {
    const otherId = m.senderUserId === meUserId ? m.recipientUserId : m.senderUserId;
    if (latestByUser.has(otherId)) continue;
    userIds.add(otherId);
    latestByUser.set(otherId, {
      body: m.body,
      createdAt: m.createdAt,
      isIncoming: m.recipientUserId === meUserId,
      unread: m.recipientUserId === meUserId ? !m.readAt : false,
    });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  const conversations = [...latestByUser.entries()]
    .map(([otherId, info]) => ({
      userId: otherId,
      username: userMap.get(otherId) ?? "?",
      latestBody: info.body.slice(0, 60),
      latestAt: info.createdAt.toISOString(),
      isIncoming: info.isIncoming,
      unread: info.unread,
    }))
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

  return NextResponse.json({ ok: true, conversations });
}

/** POST: send a DM */
export async function POST(req: Request) {
  const meUserId = await getCurrentUserId(req);
  if (!meUserId) return bad("Unauthorized", 401);

  const okEmail = await isEmailVerified(meUserId);
  if (!okEmail) return NextResponse.json({ error: "Email verification required", redirect: "/profile/edit" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const toUserId = (body?.toUserId ?? "").toString().trim();
  const text = (body?.text ?? "").toString();

  if (!toUserId) return bad("toUserId required");
  if (toUserId === meUserId) return bad("Cannot DM yourself");
  if (text.trim().length < 1) return bad("Message required");
  if (text.length > 500) return bad("Message too long (max 500)");

  const hit = checkBlockedContent(text);
  if (hit) return bad("Message contains blocked language.", 400);

  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, username: true },
  });
  if (!recipient) return bad("User not found", 404);

  const msg = await prisma.directMessage.create({
    data: { senderUserId: meUserId, recipientUserId: toUserId, body: text },
    include: { sender: { select: { username: true } } },
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      createdAt: msg.createdAt.toISOString(),
      senderUserId: msg.senderUserId,
      senderUsername: msg.sender.username,
      recipientUserId: msg.recipientUserId,
      recipientUsername: recipient.username,
      body: msg.body,
    },
  });
}
