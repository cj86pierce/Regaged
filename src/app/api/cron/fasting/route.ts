import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { requireCronAuth } from "@/lib/cronAuth";

async function runFastingTick() {
  const now = new Date();

  // lock just for fasting
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_fasting')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    // Due games (timer passed) + stuck games (null stateEndsAt) so we can unstick
    const fastingDue = await prisma.game.findMany({
      where: {
        gameType: "FASTING",
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

    for (const g of fastingDue) {
      try {
        const r = await advanceFastingIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) advanced++;
      } catch (e) {
        console.error("FASTING advance failed", { gameId: g.id, err: String(e) });
      }
    }

    return { due: fastingDue.length, advanced };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_fasting'))`;
  }
}

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });

  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runFastingTick();
  return NextResponse.json({ ok: true, fasting: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });

  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runFastingTick();
  return NextResponse.json({ ok: true, fasting: r });
}