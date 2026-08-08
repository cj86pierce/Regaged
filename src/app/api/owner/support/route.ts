import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

export const dynamic = "force-dynamic";

/** GET — list support messages. POST { id, action: "read"|"unread" } marks read state. */
export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const rows = await prisma.supportMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      body: true,
      userId: true,
      createdAt: true,
      readAt: true,
    },
  });

  // Attach usernames when the sender was logged in
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u.username]));

  return NextResponse.json({
    count: rows.length,
    unread: rows.filter((r) => !r.readAt).length,
    messages: rows.map((r) => ({
      id: r.id,
      name: r.name,
      body: r.body,
      userId: r.userId,
      username: r.userId ? byId.get(r.userId) ?? null : null,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  const action = String(body?.action ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (action === "read") {
    await prisma.supportMessage.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "unread") {
    await prisma.supportMessage.update({
      where: { id },
      data: { readAt: null },
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "delete") {
    await prisma.supportMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
