import { prisma } from "@/lib/prisma";

const DAILY_CAP = 3;
const POINTS_PER_R$ = 100; // 100 points = 1 R$

/** Grant a minimal amount of R$ to the author when they receive a PLUS vote. Capped at 3 R$/day. */
export async function grantBlogR$(userId: string, points: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const amount = Math.min(1, Math.floor(points / POINTS_PER_R$));
  if (amount <= 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { blogREarnedToday: true, blogRResetDate: true },
  });
  if (!user) return;

  let earned = user.blogREarnedToday ?? 0;
  const resetDate = user.blogRResetDate;

  // Reset daily counter if new day
  if (resetDate !== today) {
    earned = 0;
    await prisma.user.update({
      where: { id: userId },
      data: { blogREarnedToday: 0, blogRResetDate: today },
    });
  }

  const toAdd = Math.min(amount, DAILY_CAP - earned);
  if (toAdd <= 0) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      tMoney: { increment: toAdd },
      blogREarnedToday: { increment: toAdd },
      blogRResetDate: today,
    },
  });
}
