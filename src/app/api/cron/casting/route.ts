import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { advanceCastingIfDue } from "@/lib/castingAdvance";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { requireCronAuth } from "@/lib/cronAuth";

async function runCastingTick() {
  const now = new Date();
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_casting')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    const games = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [
          { stateEndsAt: { not: null, lte: now } },
          { stateEndsAt: null },
        ],
      },
      select: { id: true },
      take: 50,
    });

    let advanced = 0;
    for (const g of games) {
      try {
        const r = await advanceCastingIfDue(g.id);
        if (r.ok && ((r as any).advanced || (r as any).fixed)) advanced++;
      } catch (e) {
        console.error("CASTING catchUp failed", { gameId: g.id, err: String(e) });
      }
    }

    // Spawn drops for every active Casting (not only timer-due games)
    const activeForDrops = await prisma.game.findMany({
      where: {
        gameType: "CASTING",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      },
      select: { id: true },
      take: 50,
    });
    for (const g of activeForDrops) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }

    try {
      await applyCastingsPeriodicDecay({ gameType: "CASTING" });
    } catch (e) {
      console.error("CASTING periodic decay failed", { err: String(e) });
    }

    return { due: games.length, advanced };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_casting'))`;
  }
}

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runCastingTick();
  return NextResponse.json({ ok: true, casting: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runCastingTick();
  return NextResponse.json({ ok: true, casting: r });
}
