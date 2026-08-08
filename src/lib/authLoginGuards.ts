import { prisma } from "@/lib/prisma";
import { ipsMatch, normalizeIp } from "@/lib/clientIp";
import { isOwnerUsername } from "@/lib/usernames";

type GuardUser = {
  id: string;
  usernameLower: string;
  isOwner: boolean;
  lockedLoginIp: string | null;
  bannedAt: Date | null;
};

/**
 * Ban + IP lock checks after password/Steam identity is verified.
 * Ensures owner alias accounts are owner; applies OWNER_LOCKED_IP or first-login capture.
 * Returns null if login should proceed, or an error message if blocked.
 */
export async function enforceLoginGuards(
  user: GuardUser,
  clientIp: string | null
): Promise<{ ok: true; userId: string; username: string; isOwner: boolean } | { ok: false; reason: string }> {
  if (user.bannedAt) {
    return { ok: false, reason: "This account is banned." };
  }

  const aliasOwner = isOwnerUsername(user.usernameLower);
  let isOwner = user.isOwner || aliasOwner;
  let lockedIp = user.lockedLoginIp;

  const envIp = process.env.OWNER_LOCKED_IP?.trim();
  if (isOwner && envIp) {
    const normalized = normalizeIp(envIp);
    if (!lockedIp || !ipsMatch(lockedIp, normalized)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedLoginIp: normalized, ...(aliasOwner && !user.isOwner ? { isOwner: true } : {}) },
      });
      lockedIp = normalized;
    }
  } else if (aliasOwner && !user.isOwner) {
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
        ...(aliasOwner && !user.isOwner ? { isOwner: true } : {}),
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
    select: { id: true, username: true, isOwner: true, usernameLower: true },
  });
  if (!full) return { ok: false, reason: "Account not found." };

  return {
    ok: true,
    userId: full.id,
    username: full.username,
    isOwner: full.isOwner || isOwnerUsername(full.usernameLower),
  };
}
