import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

export async function resolveFastingNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, povUserId: true },
  });
  if (!game) return;
  if (game.state !== "ROUND_NOMINATE") return;

  // ✅ Ensure POV exists BEFORE selecting nominees
  if (!game.povUserId) {
    try {
      await assignFastingPov(gameId); // ✅ one arg now
    } catch {}
  }

  const gameAfter = await prisma.game.findUnique({
    where: { id: gameId },
    select: { roundNumber: true, povUserId: true },
  });
  const povUserId = gameAfter?.povUserId ?? null;

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, chatCount: true, plusCount: true, minusCount: true },
  });

  const eligible = players.filter((p) => p.userId !== povUserId);

  // Tally nominations
  const noms = await prisma.nomination.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const counts = new Map<string, number>();
  for (const n of noms) counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);

  // Build ranked list
  const ranked = eligible
    .map((p) => ({
      userId: p.userId,
      votes: counts.get(p.userId) ?? 0,
      activity: p.chatCount + p.plusCount - p.minusCount,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      // tie-break: more activity survives; less activity gets nominated
      return a.activity - b.activity;
    });

  const nomineeA = ranked[0]?.userId ?? null;
  const nomineeB = ranked[1]?.userId ?? null;
  if (!nomineeA || !nomineeB) return;

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
        stateEndsAt: new Date(Date.now() + 2 * 60 * 1000),
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Nominees: ${nomineeA} vs ${nomineeB}`,
      },
    });
  });
}
