import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const APPLE_CHANCE_PER_HOUR = 0.55;
const KEY_CHANCE_PER_HOUR = 0.25;

// total chance per hour = apple + key (cap at 1.0)
const TOTAL_CHANCE_PER_HOUR = Math.min(1, APPLE_CHANCE_PER_HOUR + KEY_CHANCE_PER_HOUR);

function hourKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function spawnDrop(gameId: string, kind: "APPLE" | "KEY") {
  const systemUserId = await getSystemUserId();

  // 5 visible items: 1 prize + 4 poison
  const options = shuffle(["POISON", "POISON", "POISON", "POISON", kind]) as ("APPLE" | "KEY" | "POISON")[];

  return await prisma.$transaction(async (tx) => {
    const ev = await tx.castingDropEvent.create({
      data: {
        gameId,
        dayNumber: 0,
        kind,
        messageId: "temp",
        options: {
          createMany: {
            data: options.map((k, idx) => ({ slotIndex: idx, kind: k })),
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
        body: `[CASTDROP:${ev.id}]`,
      },
      select: { id: true },
    });

    await tx.castingDropEvent.update({
      where: { id: ev.id },
      data: { messageId: msg.id },
    });

    return ev.id;
  });
}

/**
 * One-drop-per-hour TOTAL:
 * - roll once per hour
 * - if hit: choose KEY vs APPLE by relative weights
 * - prevents "double drops" (apple + key) happening back-to-back
 *
 * Uses existing hour-key fields by stamping BOTH when a drop happens,
 * so neither branch can spawn again that hour.
 */
export async function maybeSpawnCastingsDrops(gameId: string) {
  const now = new Date();
  const hk = hourKey(now);

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,

      // these already exist in your schema
      castingLastAppleHourKey: true,
      castingLastKeyHourKey: true,
    },
  });

  if (!g || g.gameType !== "CASTING") return;
  if (g.state !== "ROUND_NOMINATE" && g.state !== "ROUND_VOTE") return;

  // Already spawned something this hour (apple OR key)
  const alreadyThisHour = g.castingLastAppleHourKey === hk || g.castingLastKeyHourKey === hk;
  if (alreadyThisHour) return;

  // roll once
  if (Math.random() >= TOTAL_CHANCE_PER_HOUR) return;

  // choose kind with weights
  const r = Math.random() * (APPLE_CHANCE_PER_HOUR + KEY_CHANCE_PER_HOUR);
  const kind: "APPLE" | "KEY" = r < KEY_CHANCE_PER_HOUR ? "KEY" : "APPLE";

  await spawnDrop(gameId, kind);

  // Stamp both keys so we cannot spawn another kind this hour
  await prisma.game.update({
    where: { id: gameId },
    data: { castingLastAppleHourKey: hk, castingLastKeyHourKey: hk },
  });
}
