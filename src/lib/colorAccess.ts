import { prisma } from "@/lib/prisma";

/** Yellow (or any higher purchased level) unlocks Frookies / Rookies / Survivor. */
export async function userOwnsYellowOrHigher(userId: string): Promise<boolean> {
  const yellow = await prisma.colorLevel.findUnique({
    where: { name: "Yellow" },
    select: { id: true },
  });
  if (!yellow) return false;

  const owned = await prisma.userColor.findFirst({
    where: { userId, colorId: { gte: yellow.id } },
    select: { id: true },
  });
  return !!owned;
}
