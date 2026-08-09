import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const games = await p.game.findMany({
  where: { gameType: "CASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "ENROLLING"] } },
  select: {
    id: true,
    number: true,
    state: true,
    roundNumber: true,
    stateEndsAt: true,
    startsAt: true,
    castingLastAppleHourKey: true,
    castingLastKeyHourKey: true,
    createdAt: true,
  },
  orderBy: { number: "desc" },
  take: 10,
});

for (const g of games) {
  const actives = await p.gamePlayer.count({ where: { gameId: g.id, status: "ACTIVE" } });
  const drops = await p.castingDropEvent.count({ where: { gameId: g.id, dropType: "NORMAL" } });
  const unclaimed = await p.castingDropEvent.count({
    where: { gameId: g.id, dropType: "NORMAL", claimedAt: null },
  });
  const keyDrops = await p.castingDropEvent.count({
    where: { gameId: g.id, dropType: "NORMAL", kind: "KEY" },
  });
  const dayRes = await p.castingDayResult.findMany({
    where: { gameId: g.id },
    select: { dayNumber: true, nomineeUserIds: true, evictedUserIds: true },
  });
  const players = await p.gamePlayer.findMany({
    where: { gameId: g.id, status: "ACTIVE" },
    select: { keys: true, health: true, user: { select: { username: true } } },
  });
  console.log(
    JSON.stringify(
      {
        g,
        now: new Date().toISOString(),
        due: g.stateEndsAt ? g.stateEndsAt.getTime() <= Date.now() : null,
        actives,
        drops,
        unclaimed,
        keyDrops,
        dayRes,
        players: players.map((x) => ({ u: x.user.username, k: x.keys, hp: x.health })),
      },
      null,
      2
    )
  );
}

await p.$disconnect();
