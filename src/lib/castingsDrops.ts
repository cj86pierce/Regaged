/**
 * Casting drop system:
 * - NORMAL: public, fixed layout (☠️ ☠️ 🍏/🔑 ☠️ ☠️). Live: 1 drop/hour, ≥3 keys/day.
 * - CARE_PACKAGE: private, randomized slots, every 3000 checks.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const APPLE_CHANCE_AFTER_KEY_GUARANTEE = 0.75;
const KEYS_GUARANTEED_PER_DAY = 3;
/** Keep chat tidy — at most one unclaimed public drop sits in a game. */
const MAX_UNCLAIMED_NORMAL = 1;

function hourKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

/** Normal drop: fixed layout. Slot 2 = reward, slots 0,1,3,4 = poison. */
async function spawnNormalDrop(
  gameId: string,
  dayNumber: number,
  rewardKind: "APPLE" | "KEY"
): Promise<string> {
  const systemUserId = await getSystemUserId();

  const slotKinds: ("APPLE" | "KEY" | "POISON")[] = [
    "POISON",
    "POISON",
    rewardKind,
    "POISON",
    "POISON",
  ];

  const ev = await prisma.$transaction(async (tx) => {
    const e = await tx.castingDropEvent.create({
      data: {
        gameId,
        dayNumber,
        kind: rewardKind,
        dropType: "NORMAL",
        messageId: null,
        options: {
          createMany: {
            data: slotKinds.map((k, idx) => ({ slotIndex: idx, kind: k })),
          },
        },
      },
      select: { id: true },
    });

    const msg = await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[CASTDROP:${e.id}]`,
      },
      select: { id: true },
    });

    await tx.castingDropEvent.update({
      where: { id: e.id },
      data: { messageId: msg.id },
    });

    return e.id;
  });

  return ev;
}

/** Remove excess unclaimed public drops (and their chat messages) so old floods clear. */
export async function pruneExcessUnclaimedDrops(gameId: string): Promise<number> {
  const unclaimed = await prisma.castingDropEvent.findMany({
    where: { gameId, dropType: "NORMAL", claimedAt: null },
    select: { id: true, messageId: true },
    orderBy: { createdAt: "desc" },
  });
  if (unclaimed.length <= MAX_UNCLAIMED_NORMAL) return 0;

  const remove = unclaimed.slice(MAX_UNCLAIMED_NORMAL);
  const messageIds = remove.map((r) => r.messageId).filter((id): id is string => !!id);
  const eventIds = remove.map((r) => r.id);

  await prisma.$transaction(async (tx) => {
    if (messageIds.length) {
      await tx.gameMessage.deleteMany({ where: { id: { in: messageIds } } });
    }
    await tx.castingDropEvent.deleteMany({ where: { id: { in: eventIds } } });
  });

  return remove.length;
}

/** Heal all active casting lobbies that still have drop spam from older rates. */
export async function pruneAllActiveCastingDrops(): Promise<number> {
  const games = await prisma.game.findMany({
    where: {
      gameType: { in: ["CASTING", "CASTING_BOT"] },
      state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
    },
    select: { id: true },
    take: 40,
  });
  let removed = 0;
  for (const g of games) {
    removed += await pruneExcessUnclaimedDrops(g.id);
  }
  // Enforce 5-key cap on anyone already over (safe for live games).
  if (games.length) {
    await prisma.gamePlayer.updateMany({
      where: {
        gameId: { in: games.map((g) => g.id) },
        keys: { gt: 5 },
      },
      data: { keys: 5 },
    });
  }
  return removed;
}

function pickRewardKind(keysSpawnedToday: number): "APPLE" | "KEY" {
  if (keysSpawnedToday < KEYS_GUARANTEED_PER_DAY) return "KEY";
  return Math.random() < APPLE_CHANCE_AFTER_KEY_GUARANTEE ? "APPLE" : "KEY";
}

/** Spawn normal drops (public). Live: exactly one per UTC hour. */
export async function maybeSpawnCastingsDrops(gameId: string) {
  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      roundNumber: true,
      castingLastAppleHourKey: true,
      castingLastKeyHourKey: true,
    },
  });

  if (!g || (g.gameType !== "CASTING" && g.gameType !== "CASTING_BOT")) return;
  if (g.state !== "ROUND_NOMINATE" && g.state !== "ROUND_VOTE") return;

  await pruneExcessUnclaimedDrops(gameId);

  const dayNum = g.roundNumber ?? 1;
  const now = new Date();
  const hk = hourKey(now);

  if (g.gameType === "CASTING_BOT") {
    const existingForDay = await prisma.castingDropEvent.findFirst({
      where: { gameId, dayNumber: dayNum, dropType: "NORMAL" },
      select: { id: true },
    });
    if (!existingForDay) {
      const keysToday = await prisma.castingDropEvent.count({
        where: { gameId, dayNumber: dayNum, dropType: "NORMAL", kind: "KEY" },
      });
      await spawnNormalDrop(gameId, dayNum, pickRewardKind(keysToday));
    }
    return;
  }

  if (g.gameType === "CASTING") {
    const alreadyThisHour = g.castingLastAppleHourKey === hk || g.castingLastKeyHourKey === hk;
    if (alreadyThisHour) return;

    const keysToday = await prisma.castingDropEvent.count({
      where: { gameId, dayNumber: dayNum, dropType: "NORMAL", kind: "KEY" },
    });
    const rewardKind = pickRewardKind(keysToday);

    await spawnNormalDrop(gameId, dayNum, rewardKind);
    await prisma.game.update({
      where: { id: gameId },
      data: { castingLastAppleHourKey: hk, castingLastKeyHourKey: hk },
    });
  }
}

const CARE_PACKAGE_THRESHOLD = 3000;

/** Called when a player's checks may have crossed 3000. Spawn care package if needed. */
export async function trySpawnCarePackage(
  gameId: string,
  recipientUserId: string,
  currentPlusCount: number,
  currentMinusCount: number
): Promise<boolean> {
  const checks = currentPlusCount - currentMinusCount;
  if (checks < CARE_PACKAGE_THRESHOLD) return false;

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: recipientUserId } },
    select: { lastCarePackageAtChecks: true, status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return false;

  const nextThreshold = gp.lastCarePackageAtChecks + CARE_PACKAGE_THRESHOLD;
  if (checks < nextThreshold) return false;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")) return false;

  const newThreshold = Math.floor(checks / CARE_PACKAGE_THRESHOLD) * CARE_PACKAGE_THRESHOLD;

  const rewardSlot = Math.floor(Math.random() * 5);
  const rewardKind: "APPLE" | "KEY" = Math.random() < 0.7 ? "APPLE" : "KEY";

  function rollSlot(idx: number): "APPLE" | "KEY" | "POISON" {
    if (idx === rewardSlot) return rewardKind;
    const r = Math.random();
    if (r < 0.97) return "POISON";
    if (r < 0.99) return "APPLE";
    return "KEY";
  }

  const slotKinds: ("APPLE" | "KEY" | "POISON")[] = [0, 1, 2, 3, 4].map(rollSlot);
  const dayNum = game.roundNumber ?? 1;

  await prisma.$transaction(async (tx) => {
    await tx.castingDropEvent.create({
      data: {
        gameId,
        dayNumber: dayNum,
        kind: rewardKind,
        dropType: "CARE_PACKAGE",
        recipientUserId,
        messageId: null,
        options: {
          createMany: {
            data: slotKinds.map((k, idx) => ({ slotIndex: idx, kind: k })),
          },
        },
      },
    });
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: recipientUserId } },
      data: { lastCarePackageAtChecks: newThreshold },
    });
  });

  return true;
}
