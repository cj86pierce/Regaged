/**
 * Periodic health decay for Castings, driven by inactivity.
 *
 * Decay is computed as a *cumulative* amount for total time inactive, then
 * only the delta since the last time decay was applied to a player is
 * subtracted from their health. This makes the function safe to call at any
 * frequency (every tick, every hour, whatever) without re-applying the same
 * damage repeatedly - which is what caused CASTING_BOT players to die almost
 * instantly, since that path was previously ungated and re-subtracted the
 * full inactivity-bracket damage on every ~10s tick.
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";

const HOUR_MS = 60 * 60 * 1000;

/** Cumulative decay for total hours inactive: <1h=0; 12-24h=5; 24-36h=15; 36-48h=35; 48h+=35+30/day. */
function cumulativeDecayForInactivity(hoursInactive: number): number {
  const hours = Math.max(0, hoursInactive);
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

  const games = await prisma.game.findMany({
    where: {
      gameType: options.gameType,
      state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
    },
    select: { id: true },
    take: 50,
  });

  let processed = 0;
  const sysId = await getSystemUserId();

  for (const g of games) {
    const players = await prisma.gamePlayer.findMany({
      where: { gameId: g.id, status: "ACTIVE" },
      select: { userId: true, health: true, lastActiveAt: true, castingLastDecayAt: true },
    });

    const deaths: string[] = [];

    for (const p of players) {
      const lastActiveAt = p.lastActiveAt ?? now;
      const hoursSinceActive = (now.getTime() - lastActiveAt.getTime()) / HOUR_MS;

      // How much decay was already "priced in" as of the last time we checked this player.
      const lastDecayAt = p.castingLastDecayAt;
      const hoursSinceActiveAtLastDecay =
        lastDecayAt && lastDecayAt.getTime() > lastActiveAt.getTime()
          ? (lastDecayAt.getTime() - lastActiveAt.getTime()) / HOUR_MS
          : 0;

      const totalDecayNow = cumulativeDecayForInactivity(hoursSinceActive);
      const totalDecayAlready = cumulativeDecayForInactivity(hoursSinceActiveAtLastDecay);
      const damage = Math.max(0, totalDecayNow - totalDecayAlready);

      if (damage <= 0) {
        // Do not write every tick — that flooded the DB with no-op updates.
        continue;
      }

      const hp = (p.health ?? 70) - damage;
      const newHp = Math.max(0, hp);

      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: g.id, userId: p.userId } },
        data: {
          health: newHp,
          castingLastDecayAt: now,
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
  }

  return { processed };
}
