import { prisma } from "@/lib/prisma";
import { HOF_EXCLUDED_USERNAMES } from "@/lib/usernames";

/** Profile badge cutoff (rank shown next to names). */
export const HOF_SIZE = 500;

/** HOF page: avatars for this many, name list through this many. */
export const HOF_AVATAR_TOP = 10;
export const HOF_DISPLAY_TOP = 25;

export { HOF_EXCLUDED_USERNAMES };

/** Exclude bots / system-ish / owner accounts from Hall of Fame. */
export function hofUserWhere() {
  // Bots are created with *@regaged.bot emails (see botUsers / seed-bots).
  // Do NOT use Prisma startsWith("bot_") / startsWith("__"): those become SQL
  // LIKE with unescaped `_` wildcards and can match (or exclude) everyone.
  // Also include null emails — NOT (email endsWith …) alone drops NULLs in SQL.
  return {
    AND: [
      { OR: [{ email: null }, { NOT: { email: { endsWith: "@regaged.bot" } } }] },
      { NOT: { usernameLower: "__system__" } },
      { NOT: { usernameLower: { in: [...HOF_EXCLUDED_USERNAMES] } } },
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

function isHofExcludedUser(usernameLower: string, email: string | null): boolean {
  if (usernameLower.startsWith("bot_")) return true;
  if (usernameLower.startsWith("__")) return true;
  if (email?.endsWith("@regaged.bot")) return true;
  if ((HOF_EXCLUDED_USERNAMES as readonly string[]).includes(usernameLower)) return true;
  return false;
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
  if (isHofExcludedUser(me.usernameLower, me.email)) return null;

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
