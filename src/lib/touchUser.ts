import { prisma } from "@/lib/prisma";

export async function touchUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });
}
