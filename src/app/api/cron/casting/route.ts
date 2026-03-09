import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { runCastingsDayChangeIfDue } from "@/lib/castingsDayChange";

function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  if (req.headers.get("x-vercel-cron") === "1") return null;

  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const qs = url.searchParams.get("secret");

  if (auth === `Bearer ${secret}`) return null;
  if (qs === secret) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

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
        state: "ROUND_VOTE",
        stateEndsAt: { not: null, lte: now },
      },
      select: { id: true },
      take: 50,
    });

    let advanced = 0;
    for (const g of games) {
      try {
        const r = await runCastingsDayChangeIfDue(g.id);
        if (r.ok && ((r as any).advanced || (r as any).finished)) advanced++;
      } catch (e) {
        console.error("CASTING catchUp failed", { gameId: g.id, err: String(e) });
      }
    }

    for (const g of games) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }

    // Health decay is inside runCastingsDayChangeIfDue (at day end)

    return { due: games.length, advanced };
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
