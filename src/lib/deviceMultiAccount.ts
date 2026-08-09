import { prisma } from "@/lib/prisma";
import { resolveStaffFlags } from "@/lib/staffAccess";
import { ADMIN_USERNAME_ALIASES, OWNER_USERNAME_ALIASES } from "@/lib/usernames";

/**
 * Record this login on a browser device cookie.
 * If another non-staff account already used this device, warn both sides.
 * Owner / Admin accounts are never tracked or auto-warned (so Carson + Admin can share a device).
 */
export async function trackDeviceLogin(
  deviceId: string | null | undefined,
  userId: string
): Promise<{ multiAccount: boolean; warnedUserIds: string[] }> {
  if (!deviceId || deviceId.length < 16) {
    return { multiAccount: false, warnedUserIds: [] };
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isOwner: true, isAdmin: true, usernameLower: true },
  });
  if (!me) return { multiAccount: false, warnedUserIds: [] };

  if (resolveStaffFlags(me).isStaff) {
    return { multiAccount: false, warnedUserIds: [] };
  }

  const now = new Date();
  await prisma.deviceAccount.upsert({
    where: { deviceId_userId: { deviceId, userId } },
    create: { deviceId, userId, lastSeenAt: now },
    update: { lastSeenAt: now },
  });

  const others = await prisma.deviceAccount.findMany({
    where: { deviceId, NOT: { userId } },
    select: {
      userId: true,
      user: { select: { isOwner: true, isAdmin: true, usernameLower: true } },
    },
  });

  const otherPlayers = others.filter((o) => !resolveStaffFlags(o.user).isStaff);
  if (otherPlayers.length === 0) {
    return { multiAccount: false, warnedUserIds: [] };
  }

  const warnIds = [userId, ...otherPlayers.map((o) => o.userId)];
  await prisma.user.updateMany({
    where: {
      id: { in: warnIds },
      warnedAt: null,
      isOwner: false,
      isAdmin: false,
      usernameLower: { notIn: [...OWNER_USERNAME_ALIASES, ...ADMIN_USERNAME_ALIASES] },
    },
    data: { warnedAt: now },
  });

  return { multiAccount: true, warnedUserIds: warnIds };
}
