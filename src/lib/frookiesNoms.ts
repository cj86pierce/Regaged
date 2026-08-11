import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

import {
  BOT_ROUND_MS,
  getFastingVoteMs,
  getFrookiesPovSaveMs,
  isBotGameType,
} from "@/lib/fastingTiming";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

/**
 * Resolve Frookies nominations: HOH nominates 2. POV holder and povSavedUserId are immune
 * except at final 3 (or whenever POV immunity would leave fewer than 2 nominees) — then
 * only HOH is immune and both other houseguests go on the block, skipping POV_SAVE.
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

  // Final 3: HOH + POV immunity leaves only 1 nominee and the round never ends.
  const finalThree = players.length <= 3;
  const immune = new Set<string>([game.hohUserId]);
  if (!finalThree) {
    immune.add(game.povUserId);
    if (game.povSavedUserId) immune.add(game.povSavedUserId);
  }
  let eligible = players.filter((p) => !immune.has(p.userId));
  if (eligible.length < 2) {
    immune.clear();
    immune.add(game.hohUserId);
    eligible = players.filter((p) => !immune.has(p.userId));
  }
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

  const nameA = eligible.find((p) => p.userId === nomineeA)?.user.username ??
    players.find((p) => p.userId === nomineeA)?.user.username ??
    "?";
  const nameB = eligible.find((p) => p.userId === nomineeB)?.user.username ??
    players.find((p) => p.userId === nomineeB)?.user.username ??
    "?";

  const systemUserId = await getSystemUserId();
  const tag = `[SYSTEM:NOM_VOTES:R${game.roundNumber}]`;
  const isBot = isBotGameType(game.gameType);
  const povSaveMs = getFrookiesPovSaveMs(isBot);
  const voteMs = isBot ? BOT_ROUND_MS : getFastingVoteMs();

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: {
        nomineeAUserId: nomineeA!,
        nomineeBUserId: nomineeB!,
        nomineeCUserId: null,
        povSavedUserId: finalThree ? null : game.povSavedUserId,
      },
      create: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomineeA!,
        nomineeBUserId: nomineeB!,
        nomineeCUserId: null,
        povSavedUserId: finalThree ? null : game.povSavedUserId,
      },
    });

    if (finalThree) {
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_VOTE",
          frookiesPhase: null,
          povSavedUserId: null,
          stateEndsAt: new Date(Date.now() + voteMs),
        },
      });
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `${tag}\n[SYSTEM] Final 3 — Nominees: ${nameA} vs ${nameB}. Voting is open.`,
        },
      });
    } else {
      await tx.game.update({
        where: { id: gameId },
        data: {
          frookiesPhase: "POV_SAVE",
          stateEndsAt: new Date(Date.now() + povSaveMs),
        },
      });
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `${tag}\n[SYSTEM] Nominees: ${nameA} vs ${nameB}. POV may save themselves or one other before vote.`,
        },
      });
    }
  });
}
