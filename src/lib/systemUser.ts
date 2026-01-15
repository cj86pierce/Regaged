import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const SYSTEM_USERNAME_DISPLAY = "__system__";
const SYSTEM_USERNAME_LOWER = "__system__";

export async function getSystemUserId(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { usernameLower: SYSTEM_USERNAME_LOWER },
    select: { id: true },
  });

  if (existing) return existing.id;

  const passwordHash = await bcrypt.hash("system-user-not-for-login", 10);

  const created = await prisma.user.create({
    data: {
      username: SYSTEM_USERNAME_DISPLAY,
      usernameLower: SYSTEM_USERNAME_LOWER,
      passwordHash,
      karma: 0,
      tMoney: 0,
    },
    select: { id: true },
  });

  return created.id;
}

// ✅ helper used by reaction route etc.
export function isSystemUser(username: string) {
  return (username ?? "").toLowerCase() === SYSTEM_USERNAME_LOWER;
}
