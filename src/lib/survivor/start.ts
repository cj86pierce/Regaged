import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
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
    select: { id: true, gameType: true, state: true },
  });
  if (!game || game.gameType !== gameType) return { ok: false as const, error: "mismatch" };
  if (game.state !== "ENROLLING") return { ok: true as const, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (count < SURVIVOR_MAX) return { ok: true as const, skipped: true as const };

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
        data: { tribe: "A", food: 5, water: 5, hasImmunity: false, challengeScore: 0 },
      });
    }
    for (const uid of tribeB) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: { tribe: "B", food: 5, water: 5, hasImmunity: false, challengeScore: 0 },
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
        body: "[SYSTEM] Survivor begins! Tribes A and B assigned. Tribe challenge is open.",
      },
    });
  });

  return { ok: true as const, started: true as const };
}
