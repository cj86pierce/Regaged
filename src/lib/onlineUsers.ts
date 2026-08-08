/** Prisma where-fragment: real players only (exclude bot pool). */
export function humanUserWhere() {
  return {
    AND: [
      { NOT: { username: { startsWith: "Bot_" } } },
      // NULL email must stay included — `NOT endsWith(bot)` alone drops NULL rows in SQL.
      {
        OR: [{ email: null }, { NOT: { email: { endsWith: "@regaged.bot" } } }],
      },
    ],
  };
}

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
