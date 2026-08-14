import { prisma } from "@/lib/prisma";

/** Highest owned color strength. Used for blog/design vote weight and Rookies bet cap (2×). */
export async function getUserColorStrength(userId: string): Promise<number> {
  const purchased = await prisma.userColor.findMany({
    where: { userId },
    include: { color: { select: { strength: true } } },
  });
  if (purchased.length === 0) return 1;
  const max = purchased.reduce((best, p) => Math.max(best, p.color.strength), 0);
  return max;
}
