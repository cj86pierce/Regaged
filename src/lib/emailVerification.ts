import { prisma } from "@/lib/prisma";

/** Set true only while email delivery is broken. Enroll/shop/DMs require verified email when false. */
export const EMAIL_VERIFY_BYPASS = false;

export function isEmailVerifyDisabled() {
  return EMAIL_VERIFY_BYPASS || process.env.EMAIL_VERIFY_DISABLED === "1";
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  if (isEmailVerifyDisabled()) return true;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  return !!me?.emailVerifiedAt;
}
