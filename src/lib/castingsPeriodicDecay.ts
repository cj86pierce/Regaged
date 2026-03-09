/**
 * Periodic health decay for Castings.
 * CASTING: runs every hour.
 * CASTING_BOT: runs every minute.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const HOUR_MS = 60 * 60 * 1000;

function hourKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}

/** Decay by inactivity: <1h no decay; 12-24h=-5; 24-36h=-15; 36-48h=-35; 48h+=-35-30 per day */
function healthDecayForInactivity(lastActiveAt: Date, now: Date): number {
  const ms = now.getTime() - lastActiveAt.getTime();
  const hours = ms / HOUR_MS;
  if (hours < 1) return 0;
  if (hours < 12) return 0;
  if (hours < 24) return 5;
  if (hours < 36) return 5 + 10;
  if (hours < 48) return 5 + 10 + 20;
  const daysOver48 = Math.floor((hours - 48) / 24);
  return 35 + 30 * daysOver48;
}

export async function applyCastingsPeriodicDecay(options: {
  gameType: "CASTING" | "CASTING_BOT";
}): Promise<{ processed: number }> {
  const now = new Date();
  const hk = hourKey(now);

  const where: Prisma.GameWhereInput =
    options.gameType === "CASTING"
      ? {
          gameType: "CASTING",
          state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
          OR: [
            { castingLastDecayHourKey: null },
            { castingLastDecayHourKey: { not: hk } },
          ],
        }
      : {
          gameType: "CASTING_BOT",
          state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        };

  const games = await prisma.game.findMany({
    where,
    select: { id: true, castingLastDecayHourKey: true },
    take: 50,
  });

  let processed = 0;
  const sysId = await getSystemUserId();

  for (const g of games) {
    const players = await prisma.gamePlayer.findMany({
      where: { gameId: g.id, status: "ACTIVE" },
      select: { userId: true, health: true, lastActiveAt: true },
    });

    const deaths: string[] = [];

    for (const p of players) {
      const damage = healthDecayForInactivity(p.lastActiveAt ?? now, now);
      if (damage <= 0) continue;

      const hp = (p.health ?? 70) - damage;
      const newHp = Math.max(0, hp);

      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: g.id, userId: p.userId } },
        data: {
          health: newHp,
          ...(newHp <= 0 ? { status: "ELIMINATED", eliminatedAt: now } : {}),
        },
      });

      if (newHp <= 0) deaths.push(p.userId);
      processed++;
    }

    if (deaths.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: deaths } },
        select: { id: true, username: true },
      });
      const names = deaths.map((id) => users.find((u) => u.id === id)?.username ?? id);
      await prisma.gameMessage.create({
        data: {
          gameId: g.id,
          userId: sysId,
          channel: "PUBLIC",
          body: `[SYSTEM] ${names.join(", ")} died from inactivity.`,
        },
      });
    }

    // Update last decay hour (for CASTING)
    if (options.gameType === "CASTING") {
      await prisma.game.update({
        where: { id: g.id },
        data: { castingLastDecayHourKey: hk },
      });
    }
  }

  return { processed };
}
