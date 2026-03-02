import { prisma } from "@/lib/prisma";

/** Returns the user's color level strength (1 if no color purchased) for blog vote points. */
export async function getUserColorStrength(userId: string): Promise<number> {
  const purchased = await prisma.userColor.findMany({
    where: { userId },
    include: { color: { select: { strength: true } } },
  });
  if (purchased.length === 0) return 1;
  const max = purchased.reduce((best, p) => Math.max(best, p.color.strength), 0);
  return max;
}
