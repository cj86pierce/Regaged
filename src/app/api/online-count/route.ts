import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { humanUserWhere, ONLINE_WINDOW_MS } from "@/lib/onlineUsers";

export const dynamic = "force-dynamic";

/** GET /api/online-count - users active in the last 5 minutes (site badge). */
export async function GET() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const count = await prisma.user.count({
    where: {
      lastSeenAt: { gte: since },
      ...humanUserWhere(),
    },
  });
  return NextResponse.json({ count });
}
