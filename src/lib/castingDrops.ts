import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const APPLE_CHANCE_PER_HOUR = 0.55;
const KEY_CHANCE_PER_HOUR = 0.25;

const COOLDOWN_MS = 5 * 60 * 1000;

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

export async function maybeSpawnCastingsDrops(gameId: string) {
  const now = new Date();
  const hk = hourKey(now);

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      castingLastAppleHourKey: true,
      castingLastKeyHourKey: true,
    },
  });
  if (!g || g.gameType !== "CASTING") return;
  if (g.state !== "ROUND_NOMINATE" && g.state !== "ROUND_VOTE") return;

  // ✅ global cooldown (any drop)
  const last = await prisma.castingDropEvent.findFirst({
    where: { gameId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const ms = Date.now() - last.createdAt.getTime();
    if (ms < COOLDOWN_MS) return;
  }

  // roll apple (once per hour)
  if (g.castingLastAppleHourKey !== hk && Math.random() < APPLE_CHANCE_PER_HOUR) {
    await spawnDrop(gameId, "APPLE");
    await prisma.game.update({ where: { id: gameId }, data: { castingLastAppleHourKey: hk } });
    return; // ✅ prevent key in same tick; it can happen later after cooldown
  }

  // roll key (once per hour)
  if (g.castingLastKeyHourKey !== hk && Math.random() < KEY_CHANCE_PER_HOUR) {
    await spawnDrop(gameId, "KEY");
    await prisma.game.update({ where: { id: gameId }, data: { castingLastKeyHourKey: hk } });
    return;
  }
}
