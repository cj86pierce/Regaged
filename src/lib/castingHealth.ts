import { prisma } from "@/lib/prisma";

// 30-minute tick model (matches your earlier intent)
const TICK_MS = 30 * 60 * 1000;

// Drain per 30 minutes by time since last activity
function drainPerTick(hoursSinceActive: number) {
  if (hoursSinceActive < 2) return 1;      // 0–2h: -1 per 30m  (2/hr)
  if (hoursSinceActive < 5) return 6;      // 2–5h: -6 per 30m  (12/hr)
  if (hoursSinceActive < 7) return 12;     // 5–7h: -12 per 30m (24/hr)
  return 10;                                // 7h+: -10 per 30m (20/hr) -> dead by ~8h
}

export async function applyCastingHealthDecay() {
  const now = new Date();

  // Only apply to active casting games (we’re temporarily using ROUND_NOMINATE as the “day running” state)
  const games = await prisma.game.findMany({
    where: { gameType: "CASTING", state: "ROUND_NOMINATE" },
    select: { id: true },
    take: 25,
  });

  let processed = 0;

  for (const g of games) {
    const players = await prisma.gamePlayer.findMany({
      where: { gameId: g.id, status: "ACTIVE" },
      select: {
        userId: true,
        health: true,
        lastActiveAt: true,
        castingHealthTickedAt: true,
      },
    });

    for (const p of players) {
      const lastTick = p.castingHealthTickedAt ?? p.lastActiveAt ?? now;
      const msSinceTick = now.getTime() - lastTick.getTime();
      const ticks = Math.floor(msSinceTick / TICK_MS);

      if (ticks <= 0) continue;

      // simulate tick-by-tick drain based on time since lastActiveAt at each tick boundary
      let hp = p.health ?? 100;
      for (let i = 1; i <= ticks; i++) {
        const tickTime = new Date(lastTick.getTime() + i * TICK_MS);
        const hoursSinceActive = (tickTime.getTime() - (p.lastActiveAt ?? tickTime).getTime()) / (60 * 60 * 1000);
        hp -= drainPerTick(Math.max(0, hoursSinceActive));
        if (hp <= 0) {
          hp = 0;
          break;
        }
      }

      const newTickedAt = new Date(lastTick.getTime() + ticks * TICK_MS);

      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: g.id, userId: p.userId } },
        data: {
          health: hp,
          castingHealthTickedAt: newTickedAt,
          ...(hp <= 0 ? { status: "ELIMINATED", eliminatedAt: now } : {}),
        },
      });

      processed++;
    }
  }

  return { processed };
}
