/**
 * Resolve ROUND_NOMINATE for Casting day 2+.
 * Pick nominees by algo (keys, checks, health), create CastingDayResult, move to ROUND_VOTE.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { getDayMsForGame } from "@/lib/castingDayLength";

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

function evictCount(activeCount: number) {
  if (activeCount >= 6) return 2;
  if (activeCount === 5) return 1;
  return 0;
}

function nomineeCountForEvict(ev: number) {
  return ev >= 1 ? 3 : 0; // always 3 nominees when we evict
}

function pickNominees(
  rows: { userId: string; keys: number; plusCount: number | null; minusCount: number | null; health: number | null }[],
  count: number
) {
  const sorted = [...rows].sort((a, b) => {
    if (a.keys !== b.keys) return a.keys - b.keys;
    const ac = netChecks(a.plusCount, a.minusCount);
    const bc = netChecks(b.plusCount, b.minusCount);
    if (ac !== bc) return ac - bc;
    return (a.health ?? 70) - (b.health ?? 70);
  });
  return sorted.slice(0, count).map((x) => x.userId);
}

export async function resolveCastingNominations(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return;
  if (game.state !== "ROUND_NOMINATE") return;

  const dayNum = game.roundNumber ?? 1;
  if (dayNum <= 1) return; // day 1 has no nominees

  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const ev = evictCount(activeCount);
  const nomCount = nomineeCountForEvict(ev);
  if (nomCount === 0) return;

  const rows = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
  });
  const nominees = pickNominees(
    rows.map((r) => ({ ...r, keys: r.keys ?? 0 })),
    nomCount
  );

  const dayMs = await getDayMsForGame(gameId);
  const sysId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.castingDayResult.upsert({
      where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
      update: { nomineeUserIds: nominees, evictedUserIds: [] },
      create: { gameId, dayNumber: dayNum, nomineeUserIds: nominees, evictedUserIds: [] },
    });
    await tx.game.update({
      where: { id: gameId },
      data: { state: "ROUND_VOTE", stateEndsAt: new Date(Date.now() + dayMs) },
    });
    await tx.gameMessage.create({
      data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNum}: Nominees selected.` },
    });
  });
}
