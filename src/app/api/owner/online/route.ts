import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

/** GET /api/owner/online — players seen in the last 5 minutes (same window as site online count). */
export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const since = new Date(Date.now() - 5 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: {
      lastSeenAt: { gte: since },
      NOT: [
        { username: { startsWith: "Bot_" } },
        { email: { endsWith: "@regaged.bot" } },
      ],
    },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true,
      username: true,
      lastSeenAt: true,
      karma: true,
      tMoney: true,
      pMoney: true,
      isOwner: true,
      warnedAt: true,
      bannedAt: true,
    },
  });

  return NextResponse.json({
    count: users.length,
    online: users.map((u) => ({
      id: u.id,
      username: u.username,
      lastSeenAt: u.lastSeenAt.toISOString(),
      karma: u.karma,
      tMoney: u.tMoney,
      pMoney: u.pMoney,
      isOwner: u.isOwner,
      warned: !!u.warnedAt,
      banned: !!u.bannedAt,
    })),
  });
}
