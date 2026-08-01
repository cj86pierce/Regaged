import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

import { BOT_ROUND_MS, getFastingVoteMs } from "@/lib/fastingTiming";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

/**
 * Resolve Frookies nominations: HOH nominates 2. POV holder and povSavedUserId are immune.
 * Uses Game.povSavedUserId (POV save submitted before noms); copies to RoundResult and clears.
 */
export async function resolveFrookiesNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      state: true,
      roundNumber: true,
      hohUserId: true,
      povUserId: true,
      povSavedUserId: true,
      gameType: true,
    },
  });
  if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) return;
  if (game.state !== "ROUND_NOMINATE") return;
  if (!game.hohUserId || !game.povUserId) return;

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const immune = new Set<string>([game.hohUserId, game.povUserId]);
  if (game.povSavedUserId) immune.add(game.povSavedUserId);
  const eligible = players.filter((p) => !immune.has(p.userId));
  if (eligible.length < 2) return;

  const noms = await prisma.nomination.findMany({
    where: { gameId, roundNumber: game.roundNumber, voterUserId: game.hohUserId },
    select: { targetUserId: true },
  });
  const counts = new Map<string, number>();
  for (const n of noms) {
    if (!immune.has(n.targetUserId)) counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);
  }
  const hohNoms = eligible
    .filter((p) => (counts.get(p.userId) ?? 0) > 0)
    .sort((a, b) => (counts.get(b.userId) ?? 0) - (counts.get(a.userId) ?? 0));
  let nomineeA = hohNoms[0]?.userId ?? null;
  let nomineeB = hohNoms[1]?.userId ?? null;

  if (!nomineeA || !nomineeB) {
    const byActivity = [...eligible].sort((a, b) => activityScore(a) - activityScore(b));
    const worst = byActivity[0]?.userId;
    const second = byActivity[1]?.userId;
    if (!nomineeA) nomineeA = worst ?? eligible[0]!.userId;
    if (!nomineeB) nomineeB = (nomineeA === worst ? second : worst) ?? eligible[1]!.userId;
    if (nomineeA === nomineeB) {
      const other = eligible.find((p) => p.userId !== nomineeA);
      if (other) nomineeB = other.userId;
    }
  }

  const nameA = eligible.find((p) => p.userId === nomineeA)?.user.username ?? "?";
  const nameB = eligible.find((p) => p.userId === nomineeB)?.user.username ?? "?";

  const systemUserId = await getSystemUserId();
  const tag = `[SYSTEM:NOM_VOTES:R${game.roundNumber}]`;
  const voteMs = game.gameType === "FROOKIES_BOT" ? BOT_ROUND_MS : getFastingVoteMs();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: {
        nomineeAUserId: nomineeA!,
        nomineeBUserId: nomineeB!,
        nomineeCUserId: null,
        povSavedUserId: game.povSavedUserId,
      },
      create: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomineeA!,
        nomineeBUserId: nomineeB!,
        nomineeCUserId: null,
        povSavedUserId: game.povSavedUserId,
      },
    });

    const isBot = game.gameType === "FROOKIES_BOT";
    await tx.game.update({
      where: { id: gameId },
      data: isBot
        ? { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + voteMs), povSavedUserId: null }
        : {
            frookiesPhase: "POV_SAVE",
            stateEndsAt: new Date(Date.now() + Math.min(5 * 60_000, voteMs)),
          },
    });

    const body = isBot
      ? `${tag}\n[SYSTEM] Nominees: ${nameA} vs ${nameB}\n[SYSTEM] Vote to evict.`
      : `${tag}\n[SYSTEM] Nominees: ${nameA} vs ${nameB}. POV may save themselves or one other before vote.`;
    await tx.gameMessage.create({
      data: { gameId, userId: systemUserId, channel: "PUBLIC", body },
    });
  });
}
