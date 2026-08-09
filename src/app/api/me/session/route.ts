import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { resolveStaffFlags } from "@/lib/staffAccess";

/**
 * GET /api/me/session
 * Returns minimal user when authenticated via Bearer JWT or regaged_token cookie (Steam).
 * Used by NavBar to show logged-in state when not using NextAuth session.
 */
export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, isOwner: true, isAdmin: true, usernameLower: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const staff = resolveStaffFlags(user);
  return NextResponse.json({
    userId: user.id,
    username: user.username,
    isOwner: staff.isOwner,
    isAdmin: staff.isAdmin,
    isStaff: staff.isStaff,
  });
}
