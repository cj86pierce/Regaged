import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function requireOwner(req: Request): Promise<
  | { ok: true; ownerId: string }
  | { ok: false; status: number; error: string }
> {
  const userId = await getCurrentUserId(req);
  if (!userId) return { ok: false, status: 401, error: "Not logged in" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isOwner: true, usernameLower: true, bannedAt: true },
  });
  if (!user || user.bannedAt) return { ok: false, status: 401, error: "Not logged in" };

  const isOwner = user.isOwner || user.usernameLower === "siege";
  if (!isOwner) return { ok: false, status: 403, error: "Owner only" };

  if (!user.isOwner && user.usernameLower === "siege") {
    await prisma.user.update({ where: { id: user.id }, data: { isOwner: true } });
  }

  return { ok: true, ownerId: user.id };
}
