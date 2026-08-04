import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { tryStartSurvivorGame } from "@/lib/survivor/start";

const FIRST_PLACE = { karma: 50, tMoney: 40 };

/**
 * Tribal stage ends at 10 remaining: everyone places 1st, then auto-enrolls
 * into a new merge Survivor lobby (10 seats). Start + shuffle when full.
 */
export async function finishTribalAndSpawnMerge(
  tribalGameId: string,
  gameType: "SURVIVOR" | "SURVIVOR_BOT"
) {
  const isBot = gameType === "SURVIVOR_BOT";
  const now = new Date();
  const systemUserId = await getSystemUserId();

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId: tribalGameId, status: "ACTIVE" },
    select: { userId: true, user: { select: { username: true } } },
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

  if (!isBot) {
    for (const a of actives) {
      await prisma.user.update({
        where: { id: a.userId },
        data: {
          karma: { increment: FIRST_PLACE.karma },
          tMoney: { increment: FIRST_PLACE.tMoney },
        },
      });
    }
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
          tribe: "MERGED",
          food: 5,
          water: 5,
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
      body: `[SYSTEM] MERGE! Remaining castaways place 1st (+${FIRST_PLACE.karma} karma, +${FIRST_PLACE.tMoney} T$) and auto-enroll in the merge game. Advancing: ${names}.`,
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
        ? "[SYSTEM] Merge Survivor begins! Players shuffled — individual immunity challenges."
        : "[SYSTEM] Merge lobby waiting for 10 castaways…",
    },
  });

  return { mergeGameId: mergeGame.id, started: didStart };
}
