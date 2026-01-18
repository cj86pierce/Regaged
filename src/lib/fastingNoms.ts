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

  // Ensure POV exists first
  if (!game.povUserId) {
    try {
      await assignFastingPov(gameId);
    } catch {}
  }

  const gameAfter = await prisma.game.findUnique({
    where: { id: gameId },
    select: { povUserId: true },
  });
  const povUserId = gameAfter?.povUserId ?? null;

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const eligible = players.filter((p) => p.userId !== povUserId);

  const noms = await prisma.nomination.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const counts = new Map<string, number>();
  for (const n of noms) counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);

  const ranked = eligible
    .map((p) => ({
      userId: p.userId,
      username: p.user.username,
      votes: counts.get(p.userId) ?? 0,
      activity: p.chatCount + p.plusCount - p.minusCount,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.activity - b.activity; // less active loses ties
    });

  const nomineeA = ranked[0]?.userId ?? null;
  const nomineeB = ranked[1]?.userId ?? null;
  if (!nomineeA || !nomineeB) return;

  const systemUserId = await getSystemUserId();

  // Only show players with at least 1 nomination vote (but always include nominees)
  const filtered = ranked.filter((p) => p.votes >= 1 || p.userId === nomineeA || p.userId === nomineeB);

  // ✅ round-scoped marker so we never suppress future rounds
  const tag = `[SYSTEM:NOM_VOTES:R${game.roundNumber}]`;

  const lines = filtered.map((p) => {
    const mark = p.userId === nomineeA || p.userId === nomineeB ? "NOM" : "";
    return `${p.username}|${p.votes}|${mark}`;
  });

  const body = `${tag}\n${lines.join("\n")}`;

  await prisma.$transaction(async (tx) => {
    // Upsert round result
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: { nomineeAUserId: nomineeA, nomineeBUserId: nomineeB, evictedUserId: null },
      create: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomineeA,
        nomineeBUserId: nomineeB,
        evictedUserId: null,
      },
    });

    // Move to vote phase
    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + VOTE_PHASE_MS) },
    });

    // ✅ only skip if THIS round already posted
    const existing = await tx.gameMessage.findFirst({
      where: {
        gameId,
        channel: "PUBLIC",
        userId: systemUserId,
        body: { startsWith: tag },
      },
      select: { id: true },
    });

    if (!existing) {
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body,
        },
      });
    }
  });
}
