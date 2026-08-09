import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { resolveStaffFlags } from "@/lib/staffAccess";
import { isAdminUsername, isOwnerUsername } from "@/lib/usernames";

/** Owner or Admin staff access (owner panel, shop tools, etc.). */
export async function requireOwner(req: Request): Promise<
  | { ok: true; ownerId: string }
  | { ok: false; status: number; error: string }
> {
  const userId = await getCurrentUserId(req);
  if (!userId) return { ok: false, status: 401, error: "Not logged in" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isOwner: true, isAdmin: true, usernameLower: true, bannedAt: true },
  });
  if (!user || user.bannedAt) return { ok: false, status: 401, error: "Not logged in" };

  const { isOwner, isAdmin, isStaff } = resolveStaffFlags(user);
  if (!isStaff) return { ok: false, status: 403, error: "Owner/Admin only" };

  // Persist alias flags
  if (isOwnerUsername(user.usernameLower) && !user.isOwner) {
    await prisma.user.update({ where: { id: user.id }, data: { isOwner: true } });
  }
  if (isAdminUsername(user.usernameLower) && !user.isAdmin && !isOwner) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }

  return { ok: true, ownerId: user.id };
}
