/**
 * Unstick overdue Frookies games stuck at final 3 (HOH+POV left <2 nominees).
 * Run on VPS: node scripts/unstick-frookies.mjs
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const overdue = await p.game.findMany({
  where: {
    completedAt: null,
    gameType: { in: ["FROOKIES", "FROOKIES_BOT"] },
    state: "ROUND_NOMINATE",
    stateEndsAt: { lt: new Date() },
  },
  select: {
    id: true,
    number: true,
    gameType: true,
    roundNumber: true,
    hohUserId: true,
    povUserId: true,
  },
});

console.log("candidates:", overdue.length);

const system = await p.user.findFirst({
  where: { usernameLower: "__system__" },
  select: { id: true },
});
if (!system) {
  console.error("no __system__ user");
  process.exit(1);
}

for (const g of overdue) {
  const active = await p.gamePlayer.count({ where: { gameId: g.id, status: "ACTIVE" } });
  console.log(`#${g.number} ${g.gameType} round=${g.roundNumber} active=${active}`);
  if (active > 3) {
    console.log("  skip (not final 3)");
    continue;
  }
  if (!g.hohUserId || !g.povUserId) {
    console.log("  skip (missing hoh/pov)");
    continue;
  }

  const players = await p.gamePlayer.findMany({
    where: { gameId: g.id, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });
  const immune = new Set([g.hohUserId]);
  const eligible = players.filter((x) => !immune.has(x.userId));
  if (eligible.length < 2) {
    console.log("  cannot heal eligible < 2");
    continue;
  }
  const nomineeA = eligible[0].userId;
  const nomineeB = eligible[1].userId;
  const nameA = eligible[0].user.username;
  const nameB = eligible[1].user.username;
  const voteMs = g.gameType === "FROOKIES_BOT" ? 2 * 60 * 1000 : 3 * 60 * 1000;

  await p.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId: g.id, roundNumber: g.roundNumber } },
      update: {
        nomineeAUserId: nomineeA,
        nomineeBUserId: nomineeB,
        nomineeCUserId: null,
        povSavedUserId: null,
      },
      create: {
        gameId: g.id,
        roundNumber: g.roundNumber,
        nomineeAUserId: nomineeA,
        nomineeBUserId: nomineeB,
        nomineeCUserId: null,
        povSavedUserId: null,
      },
    });
    await tx.game.update({
      where: { id: g.id },
      data: {
        state: "ROUND_VOTE",
        frookiesPhase: null,
        povSavedUserId: null,
        stateEndsAt: new Date(Date.now() + voteMs),
      },
    });
    await tx.gameMessage.create({
      data: {
        gameId: g.id,
        userId: system.id,
        channel: "PUBLIC",
        body: `[SYSTEM:NOM_VOTES:R${g.roundNumber}]\n[SYSTEM] Final 3 — Nominees: ${nameA} vs ${nameB}. Voting is open.`,
      },
    });
  });
  console.log(`  healed -> ROUND_VOTE ${nameA} vs ${nameB}`);
}

await p.$disconnect();
