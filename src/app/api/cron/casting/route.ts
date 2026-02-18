import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { applyCastingHealthDecay } from "@/lib/castingHealth";
import { ensureCastingVotingStarted, resolveCastingVoteDue } from "@/lib/castingDay";

const CASTING_DAY_MS = 12 * 60 * 60 * 1000;

function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  // allow Vercel cron header too (helps reliability)
  if (req.headers.get("x-vercel-cron") === "1") return null;

  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const qs = url.searchParams.get("secret"); // optional support for external pingers

  if (auth === `Bearer ${secret}`) return null;
  if (qs === secret) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function catchUpCastingGame(gameId: string) {
  // per-game lock prevents double-resolve if two ticks overlap
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true as const };

  try {
    let loops = 0;

    while (loops < 5) {
      loops++;

      const g = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, state: true, roundNumber: true, stateEndsAt: true },
      });
      if (!g) break;

      const now = new Date();
      // Unstick: if stateEndsAt is null, set to now so we process this round
      if (!g.stateEndsAt) {
        await prisma.game.update({
          where: { id: gameId },
          data: { stateEndsAt: now },
        });
        continue;
      }
      if (g.stateEndsAt.getTime() > now.getTime()) break; // up to date

      // If voting day ended, resolve votes / eliminations
      if (g.state === "ROUND_VOTE") {
        await resolveCastingVoteDue(gameId, g.roundNumber ?? 1);
        // resolveCastingVoteDue() should move to next day and set new stateEndsAt,
        // or finalize the game when needed.
        continue;
      }

      // If we are in day-running placeholder, start voting day immediately
      if (g.state === "ROUND_NOMINATE") {
        // bump day and set a fresh 12h timer
        const nextDay = (g.roundNumber ?? 1) + 1;
        await prisma.game.update({
          where: { id: gameId },
          data: {
            roundNumber: nextDay,
            state: "ROUND_NOMINATE",
            stateEndsAt: new Date(Date.now() + CASTING_DAY_MS),
          },
        });

        // create nominees + switch to ROUND_VOTE for this day
        await ensureCastingVotingStarted(gameId, nextDay);
        continue;
      }

      // if some unexpected state, just push timer forward so it doesn’t stick
      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + CASTING_DAY_MS) },
      });
      break;
    }

    return { ok: true, loops };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

async function runCastingTick() {
  // global casting lock so a spam of requests doesn't overlap
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_casting')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    const games = await prisma.game.findMany({
      where: { gameType: "CASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] } },
      select: { id: true },
      take: 50,
    });

    // 1) Catch up day/vote timers
    for (const g of games) {
      try {
        await catchUpCastingGame(g.id);
      } catch (e) {
        console.error("CASTING catchUp failed", { gameId: g.id, err: String(e) });
      }
    }

    // 2) Drops
    for (const g of games) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING drops failed", { gameId: g.id, err: String(e) });
      }
    }

    // 3) Health decay (should be timestamp-based so 5-min cron is fine)
    try {
      await applyCastingHealthDecay();
    } catch (e) {
      console.error("CASTING decay failed", { err: String(e) });
    }

    return { active: games.length };
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
