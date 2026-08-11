import { prisma } from "@/lib/prisma";
import { ipsMatch, normalizeIp } from "@/lib/clientIp";
import { trackDeviceLogin } from "@/lib/deviceMultiAccount";
import { resolveStaffFlags } from "@/lib/staffAccess";
import { isAdminUsername, isOwnerUsername } from "@/lib/usernames";

type GuardUser = {
  id: string;
  usernameLower: string;
  isOwner: boolean;
  isAdmin: boolean;
  lockedLoginIp: string | null;
  bannedAt: Date | null;
};

/**
 * Ban + IP lock checks after password/Steam identity is verified.
 * Tracks device cookie for multi-account auto-warn.
 * Owner + Admin are IP-locked and exempt from multi-account warns.
 */
export async function enforceLoginGuards(
  user: GuardUser,
  clientIp: string | null,
  deviceId?: string | null
): Promise<
  | { ok: true; userId: string; username: string; isOwner: boolean; isAdmin: boolean }
  | { ok: false; reason: string }
> {
  if (user.bannedAt) {
    return { ok: false, reason: "This account is banned." };
  }

  let staff = resolveStaffFlags(user);
  let lockedIp = user.lockedLoginIp;

  if (isOwnerUsername(user.usernameLower) && !user.isOwner) {
    await prisma.user.update({ where: { id: user.id }, data: { isOwner: true } });
    staff = { ...staff, isOwner: true, isStaff: true, isAdmin: false };
  }
  if (isAdminUsername(user.usernameLower) && !user.isAdmin && !staff.isOwner) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    staff = { ...staff, isAdmin: true, isStaff: true };
  }

  const envIp = process.env.OWNER_LOCKED_IP?.trim();
  if (staff.isStaff && envIp) {
    const normalized = normalizeIp(envIp);
    if (!lockedIp || !ipsMatch(lockedIp, normalized)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedLoginIp: normalized },
      });
      lockedIp = normalized;
    }
  }

  if (staff.isStaff && !lockedIp && clientIp) {
    const normalized = normalizeIp(clientIp);
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedLoginIp: normalized },
    });
    lockedIp = normalized;
  }

  if (lockedIp) {
    // Local Next.js often has no X-Forwarded-For; allow owner/staff login for preview.
    const isDev = process.env.NODE_ENV !== "production";
    const isLocalIp =
      !!clientIp &&
      (ipsMatch(clientIp, "127.0.0.1") ||
        ipsMatch(clientIp, "::1") ||
        ipsMatch(clientIp, "::ffff:127.0.0.1"));
    const allowLocalPreview = isDev && (!clientIp || isLocalIp);
    if (!allowLocalPreview && (!clientIp || !ipsMatch(clientIp, lockedIp))) {
      return { ok: false, reason: "Login blocked: IP not allowed for this account." };
    }
  }

  try {
    await trackDeviceLogin(deviceId, user.id);
  } catch (e) {
    console.error("trackDeviceLogin failed", e);
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, isOwner: true, isAdmin: true, usernameLower: true },
  });
  if (!full) return { ok: false, reason: "Account not found." };

  const flags = resolveStaffFlags(full);
  return {
    ok: true,
    userId: full.id,
    username: full.username,
    isOwner: flags.isOwner,
    isAdmin: flags.isAdmin,
  };
}
