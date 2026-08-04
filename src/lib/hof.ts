import { prisma } from "@/lib/prisma";

export const HOF_SIZE = 500;

/** Exclude bots / system-ish accounts from Hall of Fame. */
export function hofUserWhere() {
  // Bots are created with *@regaged.bot emails (see botUsers / seed-bots).
  // Do NOT use Prisma startsWith("bot_") / startsWith("__"): those become SQL
  // LIKE with unescaped `_` wildcards and can match (or exclude) everyone.
  // Also include null emails — NOT (email endsWith …) alone drops NULLs in SQL.
  return {
    AND: [
      { OR: [{ email: null }, { NOT: { email: { endsWith: "@regaged.bot" } } }] },
      { NOT: { usernameLower: "__system__" } },
    ],
  };
}

export type HofEntry = {
  rank: number;
  userId: string;
  username: string;
  karma: number;
};

export async function getHofTop(limit = HOF_SIZE): Promise<HofEntry[]> {
  const rows = await prisma.user.findMany({
    where: hofUserWhere(),
    orderBy: [{ karma: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, username: true, karma: true },
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.id,
    username: r.username,
    karma: r.karma,
  }));
}

/**
 * 1-based karma rank among eligible users (same ordering as HOF).
 * Returns null if the user is a bot / excluded.
 */
export async function getKarmaRank(userId: string): Promise<number | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      karma: true,
      createdAt: true,
      usernameLower: true,
      email: true,
    },
  });
  if (!me) return null;
  if (
    me.usernameLower.startsWith("bot_") ||
    me.usernameLower.startsWith("__") ||
    (me.email?.endsWith("@regaged.bot") ?? false)
  ) {
    return null;
  }

  const ahead = await prisma.user.count({
    where: {
      AND: [
        hofUserWhere(),
        {
          OR: [
            { karma: { gt: me.karma } },
            {
              AND: [{ karma: me.karma }, { createdAt: { lt: me.createdAt } }],
            },
          ],
        },
      ],
    },
  });
  return ahead + 1;
}
