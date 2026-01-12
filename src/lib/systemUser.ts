import { prisma } from "@/lib/prisma";

const SYSTEM_USERNAME = "__system__";

/**
 * Ensures a dedicated SYSTEM user exists and returns its userId.
 * We never log in as this user. It only authors system messages.
 */
export async function getSystemUserId(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: SYSTEM_USERNAME },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      username: SYSTEM_USERNAME,
      passwordHash: "SYSTEM_ACCOUNT_DO_NOT_USE",
      karma: 0,
      tMoney: 0,
    },
    select: { id: true },
  });

  return created.id;
}

export async function isSystemUser(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return u?.username === SYSTEM_USERNAME;
}
