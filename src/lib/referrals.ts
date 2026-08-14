import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { siteBaseUrl } from "@/lib/email/sendMail";

export const REFERRAL_COOKIE = "rg_ref";
export const REFERRAL_REWARD_T = 5;
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(len = 8): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export function normalizeReferralInput(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]{3,24}$/.test(key)) return null;
  return key;
}

export function parseReferralCodeFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]+)`, "i"));
  if (!match?.[1]) return null;
  try {
    return normalizeReferralInput(decodeURIComponent(match[1]));
  } catch {
    return normalizeReferralInput(match[1]);
  }
}

export async function resolveReferrerId(refRaw: string | null | undefined): Promise<string | null> {
  const key = normalizeReferralInput(refRaw);
  if (!key) return null;
  const byCode = await prisma.user.findUnique({
    where: { referralCode: key },
    select: { id: true, bannedAt: true },
  });
  if (byCode && !byCode.bannedAt) return byCode.id;
  const byName = await prisma.user.findUnique({
    where: { usernameLower: key },
    select: { id: true, bannedAt: true },
  });
  if (byName && !byName.bannedAt) return byName.id;
  return null;
}

export async function ensureReferralCode(userId: string, usernameLower: string): Promise<string> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (me?.referralCode) return me.referralCode;

  const preferred = normalizeReferralInput(usernameLower);
  if (preferred) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: preferred },
      });
      return preferred;
    } catch {
      // username already used as someone else's code
    }
  }

  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return code;
    } catch {
      // unique collision
    }
  }
  throw new Error("could not mint referral code");
}

export function referralSignupUrl(code: string): string {
  return `${siteBaseUrl()}/register?ref=${encodeURIComponent(code)}`;
}

/**
 * Pay the referrer once when the referred user has verified email and joined a game.
 * Same-device / self-referral is consumed with 0 R$ so it cannot be retried.
 */
export async function maybeGrantReferralReward(referredUserId: string): Promise<void> {
  const referred = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: {
      id: true,
      referredByUserId: true,
      referralPaidAt: true,
      email: true,
      emailVerifiedAt: true,
    },
  });
  if (!referred?.referredByUserId || referred.referralPaidAt) return;
  if (!referred.email || !referred.emailVerifiedAt) return;

  const played = await prisma.gamePlayer.findFirst({
    where: { userId: referredUserId },
    select: { id: true },
  });
  if (!played) return;

  const referrerId = referred.referredByUserId;
  let reward = REFERRAL_REWARD_T;
  if (referrerId === referredUserId) {
    reward = 0;
  } else {
    const [a, b] = await Promise.all([
      prisma.deviceAccount.findMany({
        where: { userId: referredUserId },
        select: { deviceId: true },
      }),
      prisma.deviceAccount.findMany({
        where: { userId: referrerId },
        select: { deviceId: true },
      }),
    ]);
    const referrerDevices = new Set(b.map((row) => row.deviceId));
    if (a.some((row) => referrerDevices.has(row.deviceId))) {
      reward = 0;
    }
  }

  const claimed = await prisma.user.updateMany({
    where: {
      id: referredUserId,
      referredByUserId: referrerId,
      referralPaidAt: null,
    },
    data: {
      referralPaidAt: new Date(),
      referralRewardT: reward,
    },
  });
  if (claimed.count === 0) return;
  if (reward <= 0) return;

  await prisma.user.update({
    where: { id: referrerId },
    data: { tMoney: { increment: reward } },
  });
}
