import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

const FASTING_VOTE_MS = 2 * 60 * 1000; // 2 minutes

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

// Sort: more nominations first; ties -> LESS active gets nominated
function nomineeSort(a: { count: number; activity: number }, b: { count: number; activity: number }) {
  if (b.count !== a.count) return b.count - a.count;
  return a.activity - b.activity;
}

export async function resolveFastingNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true, povUserId: true },
  });
  if (!game) throw new Error("Game not found");
  if (game.gameType !== "FASTING") throw new Error("Not a FASTING game");
  if (game.state !== "ROUND_NOMINATE") throw new Error("Not in nomination phase");

  // ✅ Ensure POV exists BEFORE selecting nominees
  if (!game.povUserId) {
    await assignFastingPov(gameId, false);
  }

  const gameAfter = await prisma.game.findUnique({
    where: { id: gameId },
    select: { roundNumber: true, povUserId: true },
  });
  const povUserId = gameAfter?.povUserId ?? null;

  const existing = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
  });
  if (existing) {
    return { ok: true, alreadyResolved: true, nomineeA: existing.nomineeAUserId, nomineeB: existing.nomineeBUserId };
  }

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const activeIds = new Set(players.map((p) => p.userId));

  const noms = await prisma.nomination.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const counts = new Map<string, number>();
  for (const n of noms) {
    if (!activeIds.has(n.targetUserId)) continue;
    if (povUserId && n.targetUserId === povUserId) continue;
    counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);
  }

  const candidates = players
    .filter((p) => !povUserId || p.userId !== povUserId)
    .map((p) => ({
      userId: p.userId,
      username: p.user.username,
      count: counts.get(p.userId) ?? 0,
      activity: activityScore(p),
    }))
    .sort((a, b) => nomineeSort(a, b));

  if (candidates.length < 2) throw new Error("Not enough candidates");

  const nomineeA = candidates[0];
  const nomineeB = candidates[1];

  // Build “everyone + counts” string, with nominees bracketed for UI inversion
  const everyoneLine = candidates
    .map((c) => {
      const s = `${c.username}(${c.count})`;
      if (c.userId === nomineeA.userId || c.userId === nomineeB.userId) {
        return `[${s}]`; // bracketed = invert in UI
      }
      return s;
    })
    .join(" · ");

  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.create({
      data: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomineeA.userId,
        nomineeBUserId: nomineeB.userId,
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Nomination votes: ${everyoneLine}`,
      },
    });

    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + FASTING_VOTE_MS) },
    });
  });

  return { ok: true, nomineeA: nomineeA.userId, nomineeB: nomineeB.userId };
}
