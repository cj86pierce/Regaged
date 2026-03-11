import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** GET: messages with a specific user */
export async function GET(req: Request, { params }: { params: { userId: string } }) {
  const meUserId = await getCurrentUserId(req);
  if (!meUserId) return bad("Unauthorized", 401);

  const otherUserId = params.userId;
  if (!otherUserId) return bad("Missing userId");

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, username: true },
  });
  if (!other) return bad("User not found", 404);

  const msgs = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderUserId: meUserId, recipientUserId: otherUserId },
        { senderUserId: otherUserId, recipientUserId: meUserId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sender: { select: { username: true } },
      recipient: { select: { username: true } },
    },
  });

  const now = new Date();
  await prisma.directMessage.updateMany({
    where: { recipientUserId: meUserId, senderUserId: otherUserId, readAt: null },
    data: { readAt: now },
  });

  return NextResponse.json({
    ok: true,
    withUser: { id: other.id, username: other.username },
    messages: msgs.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      senderUserId: m.senderUserId,
      senderUsername: m.sender.username,
      recipientUserId: m.recipientUserId,
      recipientUsername: m.recipient.username,
      body: m.body,
      readAt: m.readAt?.toISOString() ?? null,
    })),
  });
}
