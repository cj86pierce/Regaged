import { prisma } from "@/lib/prisma";
import { ipsMatch, normalizeIp } from "@/lib/clientIp";

type GuardUser = {
  id: string;
  usernameLower: string;
  isOwner: boolean;
  lockedLoginIp: string | null;
  bannedAt: Date | null;
};

/**
 * Ban + IP lock checks after password/Steam identity is verified.
 * Ensures Siege is owner; applies OWNER_LOCKED_IP or first-login capture.
 * Returns null if login should proceed, or an error message if blocked.
 */
export async function enforceLoginGuards(
  user: GuardUser,
  clientIp: string | null
): Promise<{ ok: true; userId: string; username: string; isOwner: boolean } | { ok: false; reason: string }> {
  if (user.bannedAt) {
    return { ok: false, reason: "This account is banned." };
  }

  const isSiege = user.usernameLower === "siege";
  let isOwner = user.isOwner || isSiege;
  let lockedIp = user.lockedLoginIp;

  const envIp = process.env.OWNER_LOCKED_IP?.trim();
  if (isOwner && envIp) {
    const normalized = normalizeIp(envIp);
    if (!lockedIp || !ipsMatch(lockedIp, normalized)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedLoginIp: normalized, ...(isSiege && !user.isOwner ? { isOwner: true } : {}) },
      });
      lockedIp = normalized;
    }
  } else if (isSiege && !user.isOwner) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isOwner: true },
    });
  }

  if (isOwner && !lockedIp && clientIp) {
    const normalized = normalizeIp(clientIp);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedLoginIp: normalized,
        ...(isSiege && !user.isOwner ? { isOwner: true } : {}),
      },
    });
    lockedIp = normalized;
  }

  if (lockedIp) {
    if (!clientIp || !ipsMatch(clientIp, lockedIp)) {
      return { ok: false, reason: "Login blocked: IP not allowed for this account." };
    }
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, isOwner: true },
  });
  if (!full) return { ok: false, reason: "Account not found." };

  return { ok: true, userId: full.id, username: full.username, isOwner: full.isOwner || isSiege };
}
