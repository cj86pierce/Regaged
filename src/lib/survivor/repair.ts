import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignEqualSitOuts } from "@/lib/survivor/sitOuts";
import { SURVIVOR_MAX, SURVIVOR_MERGE_MAX, survivorPhaseMs } from "@/lib/survivor/timing";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Kill stuck bot merge / "Merged camp" seasons (they should never exist now).
 * Repair live merge lobbies that were padded to 20: keep ≤10, restore two tribe screens.
 */
export async function healBadSurvivorMerges() {
  const bad = await prisma.game.findMany({
    where: {
      gameType: { in: ["SURVIVOR", "SURVIVOR_BOT"] },
      state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE"] },
      OR: [{ survivorIsMerge: true }, { survivorMerged: true }],
    },
    select: {
      id: true,
      gameType: true,
      survivorIsMerge: true,
      survivorMerged: true,
      state: true,
    },
    take: 30,
  });

  let healed = 0;
  for (const g of bad) {
    try {
      if (g.gameType === "SURVIVOR_BOT") {
        await endBotMergeNow(g.id);
        healed++;
        continue;
      }
      if (g.survivorIsMerge || g.survivorMerged) {
        const did = await repairLiveMergeLobby(g.id);
        if (did) healed++;
      }
    } catch (e) {
      console.error("Survivor merge heal failed", { gameId: g.id, err: String(e) });
    }
  }
  return { healed };
}

async function endBotMergeNow(gameId: string) {
  const now = new Date();
  const systemUserId = await getSystemUserId();
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    for (const a of actives) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: a.userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: 1,
        },
      });
    }
    await tx.gamePlayer.updateMany({
      where: { gameId, status: "ELIMINATED", eliminatedPlace: { not: 1 } },
      data: { eliminatedPlace: SURVIVOR_MAX },
    });
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "COMPLETED",
        completedAt: now,
        stateEndsAt: null,
        survivorPhase: null,
        survivorMerged: false,
      },
    });
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: "[SYSTEM] Bot Survivor merge lobby closed — bots end at tribal merge (no 20-wide camp).",
      },
    });
  });
}

async function repairLiveMergeLobby(gameId: string) {
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, tribe: true },
    orderBy: { joinedAt: "asc" },
  });
  if (actives.length === 0) return false;

  const needsTrim = actives.length > SURVIVOR_MERGE_MAX;
  const allMerged = actives.every((p) => p.tribe === "MERGED" || !p.tribe);
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { survivorMerged: true, survivorIsMerge: true, state: true },
  });
  if (!game) return false;

  const needsResplit =
    game.survivorMerged || allMerged || !actives.some((p) => p.tribe === "A") || !actives.some((p) => p.tribe === "B");

  if (!needsTrim && !needsResplit) return false;

  const now = new Date();
  const systemUserId = await getSystemUserId();
  const keep = actives.slice(0, SURVIVOR_MERGE_MAX);
  const drop = actives.slice(SURVIVOR_MERGE_MAX);

  for (const d of drop) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: d.userId } },
      data: {
        status: "ELIMINATED",
        eliminatedAt: now,
        eliminatedPlace: null,
      },
    });
  }

  const shuffled = shuffle(keep.map((p) => p.userId));
  const mid = Math.ceil(shuffled.length / 2);
  const tribeA = shuffled.slice(0, mid);
  const tribeB = shuffled.slice(mid);

  for (const uid of tribeA) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: uid } },
      data: { tribe: "A", sittingOut: false, hasImmunity: false, challengeScore: 0 },
    });
  }
  for (const uid of tribeB) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: uid } },
      data: { tribe: "B", sittingOut: false, hasImmunity: false, challengeScore: 0 },
    });
  }

  if (game.state === "ENROLLING") {
    // leave enrolling; start path will finish setup
    await prisma.game.update({
      where: { id: gameId },
      data: { survivorIsMerge: true, survivorMerged: false },
    });
  } else {
    await prisma.game.update({
      where: { id: gameId },
      data: {
        survivorIsMerge: true,
        survivorMerged: false,
        survivorPhase: "TRIBE_CHALLENGE",
        state: "ROUND_NOMINATE",
        losingTribe: null,
        stateEndsAt: new Date(now.getTime() + survivorPhaseMs(false)),
      },
    });
    await assignEqualSitOuts(gameId);
  }

  await prisma.gameMessage.create({
    data: {
      gameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body: `[SYSTEM] Merge lobby repaired: ${keep.length} castaways in two tribe screens (max ${SURVIVOR_MERGE_MAX}).`,
    },
  });

  return true;
}
