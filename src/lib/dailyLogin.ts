import { prisma } from "@/lib/prisma";

/** UTC calendar day YYYY-MM-DD */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Reward table: streak day → R$ (plus bonus karma every 7th day). */
export function dailyLoginReward(streakDay: number): { tMoney: number; karma: number } {
  const day = Math.max(1, Math.min(streakDay, 7));
  const tMoney = [0, 5, 7, 10, 12, 15, 18, 25][day] ?? 25;
  const karma = streakDay > 0 && streakDay % 7 === 0 ? 10 : streakDay === 1 ? 1 : 2;
  return { tMoney, karma };
}

export type DailyLoginStatus = {
  claimedToday: boolean;
  streak: number;
  longestStreak: number;
  nextReward: { tMoney: number; karma: number };
  lastLoginRewardDate: string | null;
};

export async function getDailyLoginStatus(userId: string): Promise<DailyLoginStatus> {
  const today = utcToday();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      loginStreak: true,
      longestLoginStreak: true,
      lastLoginRewardDate: true,
    },
  });
  const streak = user?.loginStreak ?? 0;
  const claimedToday = user?.lastLoginRewardDate === today;
  const nextStreak = claimedToday ? streak : user?.lastLoginRewardDate === utcYesterday() ? streak + 1 : 1;
  return {
    claimedToday,
    streak,
    longestStreak: user?.longestLoginStreak ?? 0,
    nextReward: dailyLoginReward(claimedToday ? Math.max(1, streak) : nextStreak),
    lastLoginRewardDate: user?.lastLoginRewardDate ?? null,
  };
}

export async function claimDailyLogin(userId: string): Promise<
  | { ok: true; streak: number; longestStreak: number; reward: { tMoney: number; karma: number } }
  | { ok: false; error: "already_claimed" | "not_found" }
> {
  const today = utcToday();
  const yesterday = utcYesterday();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      loginStreak: true,
      longestLoginStreak: true,
      lastLoginRewardDate: true,
    },
  });
  if (!user) return { ok: false, error: "not_found" };
  if (user.lastLoginRewardDate === today) return { ok: false, error: "already_claimed" };

  const streak = user.lastLoginRewardDate === yesterday ? user.loginStreak + 1 : 1;
  const reward = dailyLoginReward(streak);
  const longest = Math.max(user.longestLoginStreak, streak);

  await prisma.user.update({
    where: { id: userId },
    data: {
      loginStreak: streak,
      longestLoginStreak: longest,
      lastLoginRewardDate: today,
      lastLoginAt: new Date(),
      tMoney: { increment: reward.tMoney },
      karma: { increment: reward.karma },
    },
  });

  return { ok: true, streak, longestStreak: longest, reward };
}
