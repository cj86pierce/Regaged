import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const userSelect = {
  id: true, username: true, createdAt: true, lastSeenAt: true,
  karma: true, bannedAt: true, warnedAt: true,
  _count: { select: { gamePlayers: true } },
} as const;

type LinkedUser = {
  id: string; username: string; createdAt: Date; lastSeenAt: Date;
  karma: number; bannedAt: Date | null; warnedAt: Date | null;
  _count: { gamePlayers: number };
};

function account(user: LinkedUser, first: Date, last: Date, loginCount: number | null) {
  return {
    id: user.id, username: user.username,
    createdAt: user.createdAt.toISOString(), lastSeenAt: user.lastSeenAt.toISOString(),
    firstLinkedAt: first.toISOString(), lastLinkedAt: last.toISOString(),
    loginCount, gamesPlayed: user._count.gamePlayers, karma: user.karma,
    banned: !!user.bannedAt, warned: !!user.warnedAt,
  };
}

export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const url = new URL(req.url);
  const parsed = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const source = url.searchParams.get("source") ?? "all";
  if (!["all", "ip", "device"].includes(source)) {
    return NextResponse.json({ error: "Invalid link type" }, { status: 400 });
  }
  try {
    const deviceMatching = search && source !== "ip" ? await prisma.deviceAccount.findMany({
      where: { user: { username: { contains: search, mode: "insensitive" } } },
      select: { deviceId: true }, distinct: ["deviceId"],
    }) : null;
    const deviceGroups = source === "ip" ? [] : await prisma.deviceAccount.groupBy({
      by: ["deviceId"],
      where: deviceMatching ? { deviceId: { in: deviceMatching.map((row) => row.deviceId) } } : {},
      _count: { userId: true }, _max: { lastSeenAt: true },
      having: { userId: { _count: { gt: 1 } } },
      orderBy: [{ _max: { lastSeenAt: "desc" } }, { deviceId: "asc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
    });
    const visibleDevices = deviceGroups.slice(0, PAGE_SIZE);
    const deviceRecords = visibleDevices.length ? await prisma.deviceAccount.findMany({
      where: { deviceId: { in: visibleDevices.map((group) => group.deviceId) } },
      include: { user: { select: userSelect } },
      orderBy: [{ user: { lastSeenAt: "desc" } }, { userId: "asc" }],
    }) : [];
    // Match whole IP groups, not just the matching member of a group.
    const matching = search && source !== "device" ? await prisma.userLoginIp.findMany({
      where: { OR: [{ ip: { contains: search } }, { user: { username: { contains: search, mode: "insensitive" } } }] },
      select: { ip: true }, distinct: ["ip"],
    }) : null;
    const where = matching ? { ip: { in: matching.map((row) => row.ip) } } : {};
    const grouped = source === "device" ? [] : await prisma.userLoginIp.groupBy({
      by: ["ip"], where, _count: { userId: true }, _max: { lastSeenAt: true },
      having: { userId: { _count: { gt: 1 } } },
      orderBy: [{ _max: { lastSeenAt: "desc" } }, { ip: "asc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
    });
    const visible = grouped.slice(0, PAGE_SIZE);
    const records = visible.length ? await prisma.userLoginIp.findMany({
      where: { ip: { in: visible.map((group) => group.ip) } },
      include: { user: { select: userSelect } },
      orderBy: [{ user: { lastSeenAt: "desc" } }, { userId: "asc" }],
    }) : [];
    return NextResponse.json({ page, hasNext: grouped.length > PAGE_SIZE || deviceGroups.length > PAGE_SIZE, groups: [
      ...visible.map((group) => ({
        id: `ip:${group.ip}`, source: "ip", ip: group.ip,
        accounts: records.filter((record) => record.ip === group.ip).map((record) =>
          account(record.user, record.firstSeenAt, record.lastSeenAt, record.loginCount)),
      })),
      ...visibleDevices.map((group) => ({
        id: `device:${group.deviceId}`, source: "device", ip: "",
        accounts: deviceRecords.filter((record) => record.deviceId === group.deviceId).map((record) =>
          account(record.user, record.createdAt, record.lastSeenAt, null)),
      })),
    ] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load linked accounts. Please try again." }, { status: 503 });
  }
}
