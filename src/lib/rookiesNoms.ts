import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

/** Resolve Rookies nominations: 2 from HOH + 1 algorithm, or day 7 (no HOH) all 3 from algorithm. */
export async function resolveRookiesNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, hohUserId: true, gameType: true },
  });
  if (!game || game.gameType !== "ROOKIES") return;
  if (game.state !== "ROUND_NOMINATE") return;

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });

  const isDay7NoHoh = !game.hohUserId && game.roundNumber >= 7;
  const eligible = game.hohUserId
    ? players.filter((p) => p.userId !== game.hohUserId)
    : players;
  if (eligible.length < 2) return;

  const useThreeNominees = eligible.length >= 4;

  let nomA: string;
  let nomB: string;
  let nomC: string | null;

  if (isDay7NoHoh) {
    const byWorst = [...eligible].sort((a, b) => activityScore(a) - activityScore(b));
    nomA = byWorst[0]!.userId;
    nomB = byWorst[1]!.userId;
    nomC = useThreeNominees && byWorst[2] ? byWorst[2].userId : null;
  } else {
    // HOH's 2 nominations from Nomination table
    const noms = await prisma.nomination.findMany({
      where: { gameId, roundNumber: game.roundNumber, voterUserId: game.hohUserId! },
      select: { targetUserId: true },
    });
    const counts = new Map<string, number>();
    for (const n of noms) counts.set(n.targetUserId, (counts.get(n.targetUserId) ?? 0) + 1);
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
    nomA = nomineeA;
    nomB = nomineeB;

    if (useThreeNominees) {
      const excluded = new Set([game.hohUserId, nomA, nomB]);
      const forAlgo = eligible.filter((p) => !excluded.has(p.userId));
      const byWorst = [...forAlgo].sort((a, b) => activityScore(a) - activityScore(b));
      nomC = byWorst[0]?.userId ?? eligible.find((p) => p.userId !== nomA && p.userId !== nomB)?.userId ?? null;
    } else {
      nomC = null;
    }
  }

  if (!nomA || !nomB) return;
  if (nomC && new Set([nomA, nomB, nomC]).size < 3) return;

  const systemUserId = await getSystemUserId();
  const nameA = eligible.find((p) => p.userId === nomA)?.user.username ?? "?";
  const nameB = eligible.find((p) => p.userId === nomB)?.user.username ?? "?";
  const nameC = nomC ? (eligible.find((p) => p.userId === nomC)?.user.username ?? "?") : null;

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: { nomineeAUserId: nomA, nomineeBUserId: nomB, nomineeCUserId: nomC },
      create: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomA,
        nomineeBUserId: nomB,
        nomineeCUserId: nomC,
      },
    });

    const ROOKIES_VOTE_MS = 24 * 60 * 60 * 1000;
    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + ROOKIES_VOTE_MS) },
    });

    const tag = `[SYSTEM:NOM_ROOKIES:R${game.roundNumber}]`;
    const msgBody = nomC
      ? `${tag}\n[SYSTEM] Nominees (3–2–1 vote): ${nameA}, ${nameB}, ${nameC}. Rank 3=evict, 2=evict if #1 saved, 1=save.`
      : `${tag}\n[SYSTEM] Nominees (vote to evict): ${nameA}, ${nameB}.`;
    await tx.gameMessage.create({
      data: { gameId, userId: systemUserId, channel: "PUBLIC", body: msgBody },
    });
  });
}
