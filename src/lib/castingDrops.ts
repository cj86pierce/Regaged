import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const APPLE_CHANCE_PER_HOUR = 0.55;
const KEY_CHANCE_PER_HOUR = 0.25;

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

async function spawnEvent(gameId: string, kind: "APPLE" | "KEY") {
  const systemUserId = await getSystemUserId();

  const options = shuffle([
    kind, "POISON", "POISON", "POISON", "POISON",
  ]) as ("APPLE" | "KEY" | "POISON")[];

  return await prisma.$transaction(async (tx) => {
    // Create event + options
    const ev = await tx.castingDropEvent.create({
      data: {
        gameId,
        dayNumber: 1, // optional; you can use game.roundNumber later
        kind,
        messageId: "temp", // placeholder; we’ll update after message create
        options: {
          createMany: {
            data: options.map((k, idx) => ({ slotIndex: idx, kind: k })),
          },
        },
      },
      select: { id: true },
    });

    // Create a system message referencing the drop id (no “who claimed” ever)
    const msg = await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[CASTDROP:${ev.id}]`,
      },
      select: { id: true },
    });

    // Update event with message id
    await tx.castingDropEvent.update({
      where: { id: ev.id },
      data: { messageId: msg.id },
    });

    return ev.id;
  });
}

export async function maybeSpawnCastingsDrops(gameId: string) {
  const now = new Date();
  const hk = hourKey(now);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      castingLastAppleHourKey: true,
      castingLastKeyHourKey: true,
    },
  });

 if (!game || game.gameType !== "CASTING" || game.state !== "ROUND_NOMINATE") return;

  // 1 per hour max
  if (game.castingLastAppleHourKey !== hk && Math.random() < APPLE_CHANCE_PER_HOUR) {
    await spawnEvent(gameId, "APPLE");
    await prisma.game.update({ where: { id: gameId }, data: { castingLastAppleHourKey: hk } });
  }

  if (game.castingLastKeyHourKey !== hk && Math.random() < KEY_CHANCE_PER_HOUR) {
    await spawnEvent(gameId, "KEY");
    await prisma.game.update({ where: { id: gameId }, data: { castingLastKeyHourKey: hk } });
  }
}
