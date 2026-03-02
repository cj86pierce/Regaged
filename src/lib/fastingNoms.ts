import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignFastingPov } from "@/lib/fastingPov";

const VOTE_PHASE_MS = 2 * 60 * 1000;
const BOT_ROUND_MS = 60 * 1000;

export async function resolveFastingNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, povUserId: true, gameType: true },
  });
  if (!game) return;
  if (game.state !== "ROUND_NOMINATE") return;

  // Ensure POV exists first (safe: assignFastingPov is compare-and-set)
  if (!game.povUserId) {
    try {
      await assignFastingPov(gameId);
    } catch {}
  }

  const povUserId =
    (await prisma.game.findUnique({
      where: { id: gameId },
      select: { povUserId: true },
    }))?.povUserId ?? null;

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

  const nameA = ranked[0]?.username ?? "Nominee A";
  const nameB = ranked[1]?.username ?? "Nominee B";

  const systemUserId = await getSystemUserId();
  const tag = `[SYSTEM:NOM_VOTES:R${game.roundNumber}]`;

  const filtered = ranked.filter((p) => p.votes >= 1 || p.userId === nomineeA || p.userId === nomineeB);

  const lines = filtered.map((p) => {
    const nom = p.userId === nomineeA || p.userId === nomineeB ? " (NOM)" : "";
    return `${p.username} — ${p.votes}${nom}`;
  });

  const body = `${tag}\n[SYSTEM] Nominees: ${nameA} vs ${nameB}\n[SYSTEM] Nom votes:\n${lines.join("\n")}`;

  await prisma.$transaction(async (tx) => {
    await tx.roundResult.upsert({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      update: { nomineeAUserId: nomineeA, nomineeBUserId: nomineeB, evictedUserId: null },
      create: { gameId, roundNumber: game.roundNumber, nomineeAUserId: nomineeA, nomineeBUserId: nomineeB, evictedUserId: null },
    });

    const voteMs = game.gameType === "FASTING_BOT" ? BOT_ROUND_MS : VOTE_PHASE_MS;
    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + voteMs) },
    });

    // Only skip if THIS round already posted
    const existing = await tx.gameMessage.findFirst({
      where: { gameId, channel: "PUBLIC", userId: systemUserId, body: { startsWith: tag } },
      select: { id: true },
    });

    if (!existing) {
      await tx.gameMessage.create({
        data: { gameId, userId: systemUserId, channel: "PUBLIC", body },
      });
    }
  });
}
