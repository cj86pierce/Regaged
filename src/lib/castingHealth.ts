import { prisma } from "@/lib/prisma";

const TEN_MIN_MS = 10 * 60 * 1000;

export async function applyCastingHealthDecay() {
  const now = new Date();

  // CASTING day-running placeholder state (until enum adds CASTING_DAY)
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
      const hp0 = p.health ?? 70;

      // Anchor time: we only decay since the later of lastActiveAt and last tick
      const anchor = new Date(
        Math.max(
          (p.lastActiveAt ?? now).getTime(),
          (p.castingHealthTickedAt ?? p.lastActiveAt ?? now).getTime()
        )
      );

      const ms = now.getTime() - anchor.getTime();
      const ticks = Math.floor(ms / TEN_MIN_MS);

      if (ticks <= 0) continue;

      const damage = ticks; // ✅ 1 HP per 10 min inactivity
      const hp1 = Math.max(0, Math.min(100, hp0 - damage));

      const newTickedAt = new Date(anchor.getTime() + ticks * TEN_MIN_MS);

      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: g.id, userId: p.userId } },
        data: {
          health: hp1,
          castingHealthTickedAt: newTickedAt,
          ...(hp1 <= 0 ? { status: "ELIMINATED", eliminatedAt: now } : {}),
        },
      });

      processed++;
    }
  }

  return { processed };
}
