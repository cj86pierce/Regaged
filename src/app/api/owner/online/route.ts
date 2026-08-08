import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { humanUserWhere, ONLINE_WINDOW_MS } from "@/lib/onlineUsers";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  username: string;
  lastSeenAt: Date;
  karma: number;
  tMoney: number;
  isOwner: boolean;
  warnedAt: Date | null;
  bannedAt: Date | null;
};

/** GET /api/owner/online — same window as site badge; includes in-game activity. */
export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const human = humanUserWhere();

  const [byLastSeen, byGame] = await Promise.all([
    prisma.user.findMany({
      where: { lastSeenAt: { gte: since }, ...human },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
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
    // Game tabs update GamePlayer.lastActiveAt; fold that into “online” too.
    prisma.gamePlayer.findMany({
      where: {
        lastActiveAt: { gte: since },
        user: human,
      },
      distinct: ["userId"],
      orderBy: { lastActiveAt: "desc" },
      take: 200,
      select: {
        lastActiveAt: true,
        user: {
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
        },
      },
    }),
  ]);

  const map = new Map<string, Row & { activeAt: Date }>();
  for (const u of byLastSeen) {
    map.set(u.id, { ...u, activeAt: u.lastSeenAt });
  }
  for (const g of byGame) {
    const u = g.user;
    const activeAt =
      g.lastActiveAt.getTime() > u.lastSeenAt.getTime() ? g.lastActiveAt : u.lastSeenAt;
    const prev = map.get(u.id);
    if (!prev || activeAt.getTime() > prev.activeAt.getTime()) {
      map.set(u.id, { ...u, activeAt });
    }
  }

  const online = [...map.values()].sort((a, b) => b.activeAt.getTime() - a.activeAt.getTime());

  return NextResponse.json({
    count: online.length,
    online: online.map((u) => ({
      id: u.id,
      username: u.username,
      lastSeenAt: u.activeAt.toISOString(),
      karma: u.karma,
      tMoney: u.tMoney,
      isOwner: u.isOwner,
      warned: !!u.warnedAt,
      banned: !!u.bannedAt,
    })),
  });
}
