import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

function activityScore(p: { chatCount: number; plusCount: number; minusCount: number }) {
  return p.chatCount + 2 * p.plusCount - p.minusCount;
}

/**
 * Resolve Rookies nominations (Classic Rookies FAQ):
 * - Normal day: HOH picks 2 + algorithm adds 2 least-active → 4 nominees
 * - Final 5 (≤5 active): HOH picks 2 + algorithm adds 1 → 3 nominees
 * - Day 7 (no HOH): all nominees from algorithm
 */
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

  const activeCount = players.length;
  // FAQ: final 5 → 3 nominees; otherwise 4 when possible
  const targetNomCount = activeCount <= 5 ? 3 : Math.min(4, eligible.length);

  let nomA: string;
  let nomB: string;
  let nomC: string | null = null;
  let nomD: string | null = null;

  const pickWorst = (pool: typeof eligible, n: number, exclude: Set<string>) => {
    return [...pool]
      .filter((p) => !exclude.has(p.userId))
      .sort((a, b) => activityScore(a) - activityScore(b))
      .slice(0, n)
      .map((p) => p.userId);
  };

  if (isDay7NoHoh) {
    const worst = pickWorst(eligible, targetNomCount, new Set());
    nomA = worst[0]!;
    nomB = worst[1]!;
    nomC = worst[2] ?? null;
    nomD = worst[3] ?? null;
  } else {
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
      const byActivity = pickWorst(eligible, 2, new Set());
      if (!nomineeA) nomineeA = byActivity[0] ?? eligible[0]!.userId;
      if (!nomineeB) nomineeB = byActivity.find((id) => id !== nomineeA) ?? eligible.find((p) => p.userId !== nomineeA)!.userId;
    }
    nomA = nomineeA;
    nomB = nomineeB;

    const algoNeeded = Math.max(0, targetNomCount - 2);
    const algo = pickWorst(eligible, algoNeeded, new Set([game.hohUserId!, nomA, nomB]));
    nomC = algo[0] ?? null;
    nomD = algo[1] ?? null;
  }

  if (!nomA || !nomB) return;

  const systemUserId = await getSystemUserId();
  const nameOf = (id: string | null) =>
    id ? (eligible.find((p) => p.userId === id)?.user.username ?? "?") : null;
  const names = [nomA, nomB, nomC, nomD].filter(Boolean).map((id) => nameOf(id as string));

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: {
        nomineeAUserId: nomA,
        nomineeBUserId: nomB,
        nomineeCUserId: nomC,
        nomineeDUserId: nomD,
      },
      create: {
        gameId,
        roundNumber: game.roundNumber,
        nomineeAUserId: nomA,
        nomineeBUserId: nomB,
        nomineeCUserId: nomC,
        nomineeDUserId: nomD,
      },
    });

    const ROOKIES_VOTE_MS = 24 * 60 * 60 * 1000;
    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + ROOKIES_VOTE_MS) },
    });

    const tag = `[SYSTEM:NOM_ROOKIES:R${game.roundNumber}]`;
    const pointsHint =
      names.length >= 4
        ? "Rank 0–3 (3=most want out). Top 2 by points are evicted."
        : "Rank nominees (highest points = out).";
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `${tag}\n[SYSTEM] Nominees (${names.length}): ${names.join(", ")}. ${pointsHint}`,
      },
    });
  });
}
