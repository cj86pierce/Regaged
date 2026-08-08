import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { humanUserWhere } from "@/lib/onlineUsers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/** GET /api/owner/players?page=1 — all players by lastSeenAt desc, 10 per page. */
export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const where = humanUserWhere();

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        lastSeenAt: true,
        karma: true,
        tMoney: true,
        isOwner: true,
        warnedAt: true,
        bannedAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
    players: users.map((u) => ({
      id: u.id,
      username: u.username,
      lastSeenAt: u.lastSeenAt.toISOString(),
      karma: u.karma,
      tMoney: u.tMoney,
      isOwner: u.isOwner,
      warned: !!u.warnedAt,
      banned: !!u.bannedAt,
    })),
  });
}
