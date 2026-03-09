/**
 * Casting drop system:
 * - NORMAL: public, fixed layout (☠️ ☠️ 🍏/🔑 ☠️ ☠️), 70% apple / 30% key in center. Do not expire.
 * - CARE_PACKAGE: private, randomized slots, every 3000 checks. Only recipient sees/claims.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const APPLE_CHANCE = 0.7;
const KEY_CHANCE = 0.3;

function hourKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

/** Normal drop: fixed layout. Slot 2 = reward (70% apple, 30% key), slots 0,1,3,4 = poison. */
async function spawnNormalDrop(gameId: string, dayNumber: number): Promise<string> {
  const rewardKind: "APPLE" | "KEY" = Math.random() < APPLE_CHANCE ? "APPLE" : "KEY";
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

/** Spawn normal drops (public). Drops do not expire. */
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
  if (g.gameType === "CASTING" && g.state !== "ROUND_VOTE") return;
  if (g.gameType === "CASTING_BOT" && g.state !== "ROUND_NOMINATE" && g.state !== "ROUND_VOTE") return;

  const dayNum = g.roundNumber ?? 1;
  const now = new Date();
  const hk = hourKey(now);

  if (g.gameType === "CASTING_BOT") {
    const existingForDay = await prisma.castingDropEvent.findFirst({
      where: { gameId, dayNumber: dayNum, dropType: "NORMAL" },
      select: { id: true },
    });
    if (!existingForDay) {
      await spawnNormalDrop(gameId, dayNum);
    }
    return;
  }

  if (g.gameType === "CASTING" && g.state === "ROUND_VOTE") {
    if (g.castingLastAppleHourKey !== hk && Math.random() < 0.55) {
      await spawnNormalDrop(gameId, dayNum);
      await prisma.game.update({ where: { id: gameId }, data: { castingLastAppleHourKey: hk } });
    } else if (g.castingLastKeyHourKey !== hk && Math.random() < 0.25) {
      await spawnNormalDrop(gameId, dayNum);
      await prisma.game.update({ where: { id: gameId }, data: { castingLastKeyHourKey: hk } });
    }
  }
}

const CARE_PACKAGE_THRESHOLD = 3000;

/** Called when a player's checks (plusCount - minusCount) may have crossed 3000. Spawn care package if needed. */
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
  const rewardKind: "APPLE" | "KEY" = Math.random() < APPLE_CHANCE ? "APPLE" : "KEY";

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
