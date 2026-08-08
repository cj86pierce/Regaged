import { prisma } from "@/lib/prisma";
import { isOwnerUsername, OWNER_USERNAME_ALIASES } from "@/lib/usernames";

function isPrivileged(user: { isOwner: boolean; usernameLower: string }): boolean {
  return user.isOwner || isOwnerUsername(user.usernameLower);
}

/**
 * Record this login on a browser device cookie.
 * If another non-owner/admin account already used this device, warn both sides.
 * Owner / admin (isOwner or Carson/Siege) are never tracked or auto-warned.
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
    select: { id: true, isOwner: true, usernameLower: true },
  });
  if (!me) return { multiAccount: false, warnedUserIds: [] };

  // Never track / auto-warn owner or admin accounts
  if (isPrivileged(me)) {
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
      user: { select: { isOwner: true, usernameLower: true } },
    },
  });

  const otherPlayers = others.filter((o) => !isPrivileged(o.user));
  if (otherPlayers.length === 0) {
    return { multiAccount: false, warnedUserIds: [] };
  }

  const warnIds = [userId, ...otherPlayers.map((o) => o.userId)];
  // Extra guard: never set warnedAt on owner/admin even if ids slipped through
  await prisma.user.updateMany({
    where: {
      id: { in: warnIds },
      warnedAt: null,
      isOwner: false,
      usernameLower: { notIn: [...OWNER_USERNAME_ALIASES] },
    },
    data: { warnedAt: now },
  });

  return { multiAccount: true, warnedUserIds: warnIds };
}
