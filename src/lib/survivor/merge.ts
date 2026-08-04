import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { tryStartSurvivorGame } from "@/lib/survivor/start";
import { SURVIVOR_MAX, SURVIVOR_MERGE_MAX } from "@/lib/survivor/timing";

const FIRST_PLACE = { karma: 50, tMoney: 40 };

async function closeTribalWithMergePlaces(tribalGameId: string) {
  const now = new Date();
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId: tribalGameId, status: "ACTIVE" },
    select: { userId: true, user: { select: { username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    for (const a of actives) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId: tribalGameId, userId: a.userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: 1,
        },
      });
    }

    // Only two places: 1st (made merge) or 20th (out). Normalize everyone else to 20th.
    await tx.gamePlayer.updateMany({
      where: {
        gameId: tribalGameId,
        status: "ELIMINATED",
        eliminatedPlace: { not: 1 },
      },
      data: { eliminatedPlace: SURVIVOR_MAX },
    });
    await tx.gamePlayer.updateMany({
      where: {
        gameId: tribalGameId,
        status: "ELIMINATED",
        eliminatedPlace: null,
      },
      data: { eliminatedPlace: SURVIVOR_MAX },
    });

    await tx.game.update({
      where: { id: tribalGameId },
      data: {
        state: "COMPLETED",
        completedAt: now,
        stateEndsAt: null,
        survivorPhase: null,
      },
    });
  });

  return actives;
}

/**
 * Bot tribal ends at merge — no second season that runs forever.
 * Remaining castaways place 1st; game completes.
 */
export async function finishBotTribalAtMerge(tribalGameId: string) {
  const systemUserId = await getSystemUserId();
  const actives = await closeTribalWithMergePlaces(tribalGameId);
  const names = actives.map((a) => a.user.username).join(", ");
  await prisma.gameMessage.create({
    data: {
      gameId: tribalGameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body: `[SYSTEM] MERGE! Bot Survivor ends here (one tribal → merge). Remaining place 1st: ${names}.`,
    },
  });
  return { ended: true as const, remaining: actives.length };
}

/**
 * Live tribal stage ends at 10 remaining:
 * - Remaining castaways place 1st + merge rewards, then auto-enroll in a new merge Survivor (2 tribes).
 * - Voted out = 20th only (no 2nd–19th).
 */
export async function finishTribalAndSpawnMerge(
  tribalGameId: string,
  gameType: "SURVIVOR" | "SURVIVOR_BOT"
) {
  const isBot = gameType === "SURVIVOR_BOT";
  // Bots never spawn a merge season — they stop at the merge beat.
  if (isBot) return finishBotTribalAtMerge(tribalGameId);

  const systemUserId = await getSystemUserId();
  const activesAll = await closeTribalWithMergePlaces(tribalGameId);
  // Only the merge cast (≤10) move into the new lobby — never a 20-wide camp.
  const actives = activesAll.slice(0, SURVIVOR_MERGE_MAX);

  for (const a of actives) {
    await prisma.user.update({
      where: { id: a.userId },
      data: {
        karma: { increment: FIRST_PLACE.karma },
        tMoney: { increment: FIRST_PLACE.tMoney },
      },
    });
  }

  const mergeGame = await prisma.game.create({
    data: {
      gameType,
      state: "ENROLLING",
      roundNumber: 0,
      survivorIsMerge: true,
      survivorMerged: false,
    },
    select: { id: true },
  });

  for (const a of actives) {
    const existing = await prisma.gamePlayer.findUnique({
      where: { gameId_userId: { gameId: mergeGame.id, userId: a.userId } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.gamePlayer.create({
        data: {
          gameId: mergeGame.id,
          userId: a.userId,
          status: "ACTIVE",
          // Tribes assigned when merge starts (always A/B, never one camp).
          tribe: null,
          food: 35,
          water: 35,
          health: 100,
          challengeScore: 0,
          hasImmunity: false,
          sittingOut: false,
        },
      });
    }
  }

  const names = actives.map((a) => a.user.username).join(", ");
  await prisma.gameMessage.create({
    data: {
      gameId: tribalGameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body: `[SYSTEM] MERGE! Remaining castaways place 1st (+${FIRST_PLACE.karma} karma, +${FIRST_PLACE.tMoney} T$) and auto-enroll in the merge game (2 new tribes). Everyone voted out: 20th. Advancing: ${names}.`,
    },
  });

  const started = await tryStartSurvivorGame(mergeGame.id, gameType);
  const didStart = started.ok && "started" in started && !!started.started;

  await prisma.gameMessage.create({
    data: {
      gameId: mergeGame.id,
      userId: systemUserId,
      channel: "PUBLIC",
      body: didStart
        ? "[SYSTEM] Merge Survivor begins — reshuffled into two tribes."
        : "[SYSTEM] Merge lobby waiting for castaways…",
    },
  });

  return { mergeGameId: mergeGame.id, started: didStart };
}
