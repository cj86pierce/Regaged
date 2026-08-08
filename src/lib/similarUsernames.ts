import { prisma } from "@/lib/prisma";
import { isOwnerUsername } from "@/lib/usernames";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripTrailingDigits(name: string): string {
  return name.replace(/\d+$/, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export type SimilarReason = "prefix" | "digits" | "near";

/** True when two display names look like alts (Aquamarine/Aquamarine1, Imon/ImonG). */
export function similarUsernameReason(a: string, b: string): SimilarReason | null {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb || na === nb) return null;

  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;

  // One is the other plus a short suffix (Imon / ImonG, Aquamarine / Aquamarine1)
  if (short.length >= 3 && long.startsWith(short) && long.length - short.length <= 3) {
    return "prefix";
  }

  const da = stripTrailingDigits(na);
  const db = stripTrailingDigits(nb);
  if (da.length >= 3 && da === db && na !== nb) {
    return "digits";
  }

  if (short.length >= 4 && Math.abs(na.length - nb.length) <= 2 && levenshtein(na, nb) <= 2) {
    return "near";
  }

  return null;
}

function orderedPair(a: { id: string; username: string }, b: { id: string; username: string }) {
  return a.id < b.id
    ? { userAId: a.id, userBId: b.id, usernameA: a.username, usernameB: b.username }
    : { userAId: b.id, userBId: a.id, usernameA: b.username, usernameB: a.username };
}

/**
 * After register/rename: if this account's name is very close to another player's,
 * create an owner alert (does not warn anyone).
 */
export async function maybeAlertSimilarUsernames(user: {
  id: string;
  username: string;
  usernameLower: string;
}): Promise<number> {
  if (isOwnerUsername(user.usernameLower)) return 0;

  const raw = normalize(user.usernameLower);
  if (raw.length < 3) return 0;

  const stem = stripTrailingDigits(raw) || raw;
  const prefix = stem.slice(0, Math.min(4, stem.length));

  const stemPrefix = stem.slice(0, Math.min(stem.length, 8));
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      isOwner: false,
      bannedAt: null,
      OR: [
        { usernameLower: { startsWith: prefix } },
        ...(stemPrefix !== prefix ? [{ usernameLower: { startsWith: stemPrefix } }] : []),
      ],
    },
    select: { id: true, username: true, usernameLower: true, email: true },
    take: 80,
  });

  let created = 0;
  for (const other of candidates) {
    if (isOwnerUsername(other.usernameLower)) continue;
    if (other.usernameLower.startsWith("bot_") || other.usernameLower.startsWith("__")) continue;
    if (other.email?.endsWith("@regaged.bot")) continue;
    const reason = similarUsernameReason(user.username, other.username);
    if (!reason) continue;
    const pair = orderedPair(
      { id: user.id, username: user.username },
      { id: other.id, username: other.username }
    );
    try {
      await prisma.similarNameAlert.create({
        data: { ...pair, reason },
      });
      created++;
    } catch {
      // unique pair already alerted
    }
  }
  return created;
}
