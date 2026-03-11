import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ unread: 0 });

  const unread = await prisma.directMessage.count({
    where: { recipientUserId: userId, readAt: null },
  });

  return NextResponse.json({ unread });
}
