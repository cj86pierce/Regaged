import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";

function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function runCastingTick() {
  // lock just for casting
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_casting')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    const castingActive = await prisma.game.findMany({
      where: { gameType: "CASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] } },
      select: { id: true },
      take: 50,
    });

    for (const g of castingActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }

    try {
      await applyCastingHealthDecay();
    } catch (e) {
      console.error("CASTING decay failed", { err: String(e) });
    }

    return { active: castingActive.length };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_casting'))`;
  }
}

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });

  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runCastingTick();
  return NextResponse.json({ ok: true, casting: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });

  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runCastingTick();
  return NextResponse.json({ ok: true, casting: r });
}