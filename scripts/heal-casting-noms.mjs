/**
 * One-shot: open noms/vote on any live CASTING game stuck on day 2+ compete-only,
 * and prune excess unclaimed drops.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function openVoteDay(gameId, dayNumber) {
  if (dayNumber <= 1) return "noop";

  const activeCount = await p.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const nomCount = activeCount <= 5 ? 0 : activeCount <= 7 ? 2 : 3;
  if (nomCount === 0) {
    console.log(`  ${gameId}: ≤5 active — leave for finalize path`);
    return "skip_finals";
  }

  const rows = await p.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: {
      userId: true,
      castingDayMiniGameScore: true,
      plusCount: true,
      minusCount: true,
    },
  });
  const scored = rows.map((r) => ({
    ...r,
    checks: (r.plusCount ?? 0) - (r.minusCount ?? 0),
    rnd: Math.random(),
  }));
  scored.sort(
    (a, b) =>
      (a.castingDayMiniGameScore ?? 0) - (b.castingDayMiniGameScore ?? 0) ||
      a.checks - b.checks ||
      a.rnd - b.rnd
  );
  const nominees = scored.slice(0, nomCount).map((x) => x.userId);

  const dayMs = 12 * 60 * 60 * 1000;
  const sys = await p.user.findFirst({
    where: { usernameLower: "__system__" },
    select: { id: true },
  });
  const names = await p.user.findMany({
    where: { id: { in: nominees } },
    select: { id: true, username: true },
  });
  const nameOf = (id) => names.find((u) => u.id === id)?.username ?? id;

  await p.$transaction(async (tx) => {
    await tx.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber } },
      update: { nomineeUserIds: nominees, evictedUserIds: [] },
      create: { gameId, dayNumber, nomineeUserIds: nominees, evictedUserIds: [] },
    });
    await tx.game.update({
      where: { id: gameId },
      data: {
        roundNumber: dayNumber,
        state: "ROUND_VOTE",
        stateEndsAt: new Date(Date.now() + dayMs),
      },
    });
    await tx.gamePlayer.updateMany({
      where: { gameId, status: "ACTIVE" },
      data: { castingDayMiniGameScore: 0 },
    });
    if (sys?.id) {
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: sys.id,
          channel: "PUBLIC",
          body: `[SYSTEM] Day ${dayNumber}: Nominees — ${nominees.map(nameOf).join(", ")}. Vote now (1/2/3 points).`,
        },
      });
    }
  });

  console.log(`  # healed → ROUND_VOTE day ${dayNumber}; noms: ${nominees.map(nameOf).join(", ")}`);
  return "vote";
}

async function pruneDrops(gameId) {
  const unclaimed = await p.castingDropEvent.findMany({
    where: { gameId, dropType: "NORMAL", claimedAt: null },
    select: { id: true, messageId: true },
    orderBy: { createdAt: "desc" },
  });
  if (unclaimed.length <= 1) return 0;
  const remove = unclaimed.slice(1);
  const messageIds = remove.map((r) => r.messageId).filter(Boolean);
  const eventIds = remove.map((r) => r.id);
  await p.$transaction(async (tx) => {
    if (messageIds.length) await tx.gameMessage.deleteMany({ where: { id: { in: messageIds } } });
    await tx.castingDropEvent.deleteMany({ where: { id: { in: eventIds } } });
  });
  return remove.length;
}

const games = await p.game.findMany({
  where: {
    gameType: "CASTING",
    state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
  },
  select: { id: true, number: true, state: true, roundNumber: true },
  orderBy: { number: "desc" },
});

console.log(`Active CASTING games: ${games.length}`);
for (const g of games) {
  console.log(`#${g.number} ${g.id} state=${g.state} day=${g.roundNumber}`);
  const pruned = await pruneDrops(g.id);
  if (pruned) console.log(`  pruned ${pruned} excess unclaimed drops`);

  await p.gamePlayer.updateMany({
    where: { gameId: g.id, keys: { gt: 5 } },
    data: { keys: 5 },
  });

  if (g.state === "ROUND_NOMINATE" && (g.roundNumber ?? 1) >= 2) {
    await openVoteDay(g.id, g.roundNumber ?? 2);
  } else {
    console.log(`  ok (no noms heal needed)`);
  }
}

await p.$disconnect();
console.log("done");
