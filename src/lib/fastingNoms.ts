import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

const VOTE_PHASE_MS = 2 * 60 * 1000;

export async function resolveFastingNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, povUserId: true },
  });
  if (!game) return;
  if (game.state !== "ROUND_NOMINATE") return;

  // Ensure POV exists BEFORE selecting nominees
  if (!game.povUserId) {
    try {
      await assignFastingPov(gameId);
    } catch {}
  }

  const gameAfter = await prisma.game.findUnique({
    where: { id: gameId },
    select: { roundNumber: true, povUserId: true },
  });
  const povUserId = gameAfter?.povUserId ?? null;

  // Active players
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const eligible = players.filter((p) => p.userId !== povUserId);

  // Tally nominations
  const noms = await prisma.nomination.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const counts = new Map<string, number>();
  for (const n of noms) counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);

  // Rank by votes (desc), tie-break by activity (asc means less active is worse → gets nominated)
  const ranked = eligible
    .map((p) => ({
      userId: p.userId,
      username: p.user.username,
      votes: counts.get(p.userId) ?? 0,
      activity: p.chatCount + p.plusCount - p.minusCount,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.activity - b.activity;
    });

  const nomineeA = ranked[0]?.userId ?? null;
  const nomineeB = ranked[1]?.userId ?? null;
  if (!nomineeA || !nomineeB) return;

  const nameA = ranked[0]?.username ?? nomineeA;
  const nameB = ranked[1]?.username ?? nomineeB;

  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: { nomineeAUserId: nomineeA, nomineeBUserId: nomineeB, evictedUserId: null },
      create: { gameId, roundNumber: game.roundNumber, nomineeAUserId: nomineeA, nomineeBUserId: nomineeB, evictedUserId: null },
    });

    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_VOTE",
        stateEndsAt: new Date(Date.now() + VOTE_PHASE_MS),
      },
    });

    // ✅ readable nominee message (names not ids)
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Nominees: ${nameA} vs ${nameB}`,
      },
    });
  });
}
