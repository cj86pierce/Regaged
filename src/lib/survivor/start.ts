import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { assignEqualSitOuts } from "@/lib/survivor/sitOuts";
import { SURVIVOR_MAX, survivorPhaseMs } from "@/lib/survivor/timing";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function tryStartSurvivorGame(gameId: string, gameType: "SURVIVOR" | "SURVIVOR_BOT") {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, survivorIsMerge: true },
  });
  if (!game || game.gameType !== gameType) return { ok: false as const, error: "mismatch" };
  if (game.state !== "ENROLLING") return { ok: true as const, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

  if (game.survivorIsMerge) {
    // Merge lobbies are auto-filled (not public). Start once survivors are seated (usually 10).
    if (count < 2) return { ok: true as const, skipped: true as const };
    return startMergeSurvivor(gameId, gameType);
  }

  if (count < SURVIVOR_MAX) return { ok: true as const, skipped: true as const };
  // Cap overflow (race enroll) so tribes are always 10 + 10.
  if (count > SURVIVOR_MAX) {
    await trimActivePlayers(gameId, SURVIVOR_MAX);
  }
  return startTribalSurvivor(gameId, gameType);
}

/** Keep earliest joiners; drop extras so the lobby cannot start over max. */
async function trimActivePlayers(gameId: string, max: number) {
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });
  const drop = players.slice(max);
  for (const d of drop) {
    await prisma.gamePlayer.delete({
      where: { gameId_userId: { gameId, userId: d.userId } },
    });
  }
}

async function startMergeSurvivor(gameId: string, gameType: "SURVIVOR" | "SURVIVOR_BOT") {
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
  });
  const shuffled = shuffle(players.map((p) => p.userId));

  const now = new Date();
  const isBot = gameType === "SURVIVOR_BOT";
  const phaseMs = survivorPhaseMs(isBot);
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    // Clear seats then reassign shuffled order
    for (const uid of shuffled) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: { seatIndex: null },
      });
    }
    for (let i = 0; i < shuffled.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: shuffled[i] } },
        data: {
          seatIndex: i + 1,
          tribe: "MERGED",
          food: 5,
          water: 5,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
          health: 100,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: 1,
        startsAt: now,
        roundStartedAt: now,
        stateEndsAt: new Date(now.getTime() + phaseMs),
        survivorPhase: "INDIVIDUAL_CHALLENGE",
        survivorMerged: true,
        survivorIsMerge: true,
        losingTribe: null,
        tribeAFood: 10,
        tribeAWater: 10,
        tribeAFire: true,
        tribeBFood: 10,
        tribeBWater: 10,
        tribeBFire: true,
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: "[SYSTEM] Merge Survivor starts! Castaways shuffled. Play the challenge for individual immunity.",
      },
    });
  });

  return { ok: true as const, started: true as const, merge: true as const };
}

async function startTribalSurvivor(gameId: string, gameType: "SURVIVOR" | "SURVIVOR_BOT") {
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
  });
  const shuffled = shuffle(players.map((p) => p.userId));
  const tribeA = shuffled.slice(0, 10);
  const tribeB = shuffled.slice(10, 20);

  const now = new Date();
  const isBot = gameType === "SURVIVOR_BOT";
  const phaseMs = survivorPhaseMs(isBot);
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    for (const uid of tribeA) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          tribe: "A",
          food: 5,
          water: 5,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
        },
      });
    }
    for (const uid of tribeB) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          tribe: "B",
          food: 5,
          water: 5,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
        },
      });
    }

    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: 1,
        startsAt: now,
        roundStartedAt: now,
        stateEndsAt: new Date(now.getTime() + phaseMs),
        survivorPhase: "TRIBE_CHALLENGE",
        survivorMerged: false,
        survivorIsMerge: false,
        losingTribe: null,
        tribeAFood: 10,
        tribeAWater: 10,
        tribeAFire: true,
        tribeBFood: 10,
        tribeBWater: 10,
        tribeBFire: true,
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: "[SYSTEM] Survivor begins! Tribes A and B assigned. Equal competitors per tribe — play the challenge.",
      },
    });
  });

  await assignEqualSitOuts(gameId);

  return { ok: true as const, started: true as const };
}
