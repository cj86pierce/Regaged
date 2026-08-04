import { prisma } from "@/lib/prisma";

/** TEMP: bypass email verification while SendGrid is broken. Flip to false when fixed. */
export const EMAIL_VERIFY_BYPASS = true;

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
