import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const url = new URL(req.url);
  const parsed = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  try {
    // Match whole IP groups, not just the matching member of a group.
    const matching = search ? await prisma.userLoginIp.findMany({
      where: { OR: [{ ip: { contains: search } }, { user: { username: { contains: search, mode: "insensitive" } } }] },
      select: { ip: true }, distinct: ["ip"],
    }) : null;
    const where = matching ? { ip: { in: matching.map((row) => row.ip) } } : {};
    const grouped = await prisma.userLoginIp.groupBy({
      by: ["ip"], where, _count: { userId: true }, _max: { lastSeenAt: true },
      having: { userId: { _count: { gt: 1 } } },
      orderBy: [{ _max: { lastSeenAt: "desc" } }, { ip: "asc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
    });
    const visible = grouped.slice(0, PAGE_SIZE);
    const records = await prisma.userLoginIp.findMany({
      where: { ip: { in: visible.map((group) => group.ip) } },
      include: { user: { select: {
        id: true, username: true, createdAt: true, lastSeenAt: true,
        karma: true, bannedAt: true, warnedAt: true,
        _count: { select: { gamePlayers: true } },
      } } },
      orderBy: [{ user: { lastSeenAt: "desc" } }, { userId: "asc" }],
    });
    return NextResponse.json({ page, hasNext: grouped.length > PAGE_SIZE, groups: visible.map((group) => ({
      ip: group.ip,
      accounts: records.filter((record) => record.ip === group.ip).map((record) => ({
        id: record.user.id, username: record.user.username,
        createdAt: record.user.createdAt.toISOString(), lastSeenAt: record.user.lastSeenAt.toISOString(),
        firstIpLoginAt: record.firstSeenAt.toISOString(), lastIpLoginAt: record.lastSeenAt.toISOString(),
        loginCount: record.loginCount, gamesPlayed: record.user._count.gamePlayers, karma: record.user.karma,
        banned: !!record.user.bannedAt, warned: !!record.user.warnedAt,
      })),
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load shared IPs. Check that the login IP migration has been applied." }, { status: 503 });
  }
}
