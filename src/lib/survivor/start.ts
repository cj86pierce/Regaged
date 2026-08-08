import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { initCampOnStart, personalMetersFromHealth } from "@/lib/survivor/camp";
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

export async function tryStartSurvivorGame(gameId: string, gameType: "SURVIVOR" | "SURVIVOR_BOT") {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, survivorIsMerge: true },
  });
  if (!game || game.gameType !== gameType) return { ok: false as const, error: "mismatch" };
  if (game.state !== "ENROLLING") return { ok: true as const, skipped: true as const };

  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

  if (game.survivorIsMerge) {
    // Merge = only the ≤10 advancers. Never pad with bots / late joiners.
    if (count > SURVIVOR_MERGE_MAX) {
      await trimActivePlayers(gameId, SURVIVOR_MERGE_MAX);
    }
    const seated = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    if (seated < 2) return { ok: true as const, skipped: true as const };
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
  // Hard cap: merge lobby is only the advancers (≤10), then shuffle into two tribe screens.
  await trimActivePlayers(gameId, SURVIVOR_MERGE_MAX);
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
    orderBy: { joinedAt: "asc" },
  });
  const shuffled = shuffle(players.map((p) => p.userId).slice(0, SURVIVOR_MERGE_MAX));
  // Two tribe lobbies (e.g. 5 + 5) — never one 20-wide merged strip.
  const mid = Math.ceil(shuffled.length / 2);
  const tribeA = shuffled.slice(0, mid);
  const tribeB = shuffled.slice(mid);

  const now = new Date();
  const isBot = gameType === "SURVIVOR_BOT";
  const phaseMs = survivorPhaseMs(isBot);
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    for (const uid of shuffled) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: { seatIndex: null },
      });
    }
    let seat = 1;
    for (const uid of tribeA) {
      const meters = personalMetersFromHealth(40);
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          seatIndex: seat++,
          tribe: "A",
          food: meters.food,
          water: meters.water,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
          health: 70,
        },
      });
    }
    for (const uid of tribeB) {
      const meters = personalMetersFromHealth(40);
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          seatIndex: seat++,
          tribe: "B",
          food: meters.food,
          water: meters.water,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
          health: 70,
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
        // Merge stage still uses two tribe screens (not one combined camp).
        survivorPhase: "TRIBE_CHALLENGE",
        survivorMerged: false,
        survivorIsMerge: true,
        losingTribe: null,
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Merge Survivor starts! Reshuffled into Tribe A (${tribeA.length}) and Tribe B (${tribeB.length}). Camp meters reset low.`,
      },
    });
  });

  await initCampOnStart(gameId);
  await assignEqualSitOuts(gameId);
  void import("@/lib/email/notifyGameStarted").then((m) => m.notifyGameStarted(gameId));
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
      const meters = personalMetersFromHealth(100);
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          tribe: "A",
          health: 100,
          food: meters.food,
          water: meters.water,
          hasImmunity: false,
          challengeScore: 0,
          sittingOut: false,
        },
      });
    }
    for (const uid of tribeB) {
      const meters = personalMetersFromHealth(100);
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: uid } },
        data: {
          tribe: "B",
          health: 100,
          food: meters.food,
          water: meters.water,
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
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: "[SYSTEM] Survivor begins! Tribes assigned. Manage camp food/water/fire — and play the challenge.",
      },
    });
  });

  await initCampOnStart(gameId);
  await assignEqualSitOuts(gameId);
  void import("@/lib/email/notifyGameStarted").then((m) => m.notifyGameStarted(gameId));

  return { ok: true as const, started: true as const };
}
