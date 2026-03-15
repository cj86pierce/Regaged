import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/online-count - count users online in last 5 minutes, excluding bots. */
export async function GET() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const count = await prisma.user.count({
    where: {
      lastSeenAt: { gte: since },
      username: { not: { startsWith: "__" } },
    },
  });
  return NextResponse.json({ count });
}
