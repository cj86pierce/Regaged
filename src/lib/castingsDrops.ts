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

async function spawnDrop(gameId: string, kind: "APPLE" | "KEY", dayNumber = 0) {
  const systemUserId = await getSystemUserId();

  const options = shuffle(["POISON", "POISON", "POISON", "POISON", kind]) as ("APPLE" | "KEY" | "POISON")[];

  return await prisma.$transaction(async (tx) => {
    const ev = await tx.castingDropEvent.create({
      data: {
        gameId,
        dayNumber,
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

export async function maybeSpawnCastingsDrops(gameId: string) {
  const now = new Date();
  const hk = hourKey(now);

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

  // CASTING_BOT: guarantee 1 drop per day
  if (g.gameType === "CASTING_BOT") {
    const existingForDay = await prisma.castingDropEvent.findFirst({
      where: { gameId, dayNumber: dayNum },
      select: { id: true },
    });
    if (!existingForDay) {
      const kind: "APPLE" | "KEY" = Math.random() < 0.6 ? "APPLE" : "KEY";
      await spawnDrop(gameId, kind, dayNum);
    }
    return;
  }

  // CASTING (12h days): probabilistic per hour
  if (g.state !== "ROUND_VOTE") return;
  if (g.castingLastAppleHourKey !== hk && Math.random() < APPLE_CHANCE_PER_HOUR) {
    await spawnDrop(gameId, "APPLE", dayNum);
    await prisma.game.update({ where: { id: gameId }, data: { castingLastAppleHourKey: hk } });
  } else if (g.castingLastKeyHourKey !== hk && Math.random() < KEY_CHANCE_PER_HOUR) {
    await spawnDrop(gameId, "KEY", dayNum);
    await prisma.game.update({ where: { id: gameId }, data: { castingLastKeyHourKey: hk } });
  }
}
