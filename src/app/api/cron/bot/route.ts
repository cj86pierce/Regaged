/**
 * Cron tick for bot games: fill lobbies after 15m, advance rounds, bot actions.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
import { advanceSurvivorIfDue } from "@/lib/survivor/advance";
import { maybeStartEnrollingLobby } from "@/lib/lobbyTiming";
import { performBotActions } from "@/lib/botActions";
import { applyCastingsPeriodicDecay } from "@/lib/castingsPeriodicDecay";
import { maybeSpawnCastingsDrops } from "@/lib/castingsDrops";
import { requireCronAuth } from "@/lib/cronAuth";

async function runBotTick() {
  const now = new Date();

  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext('cron_bot')) as locked
  `;
  if (!lockRows?.[0]?.locked) return { skipped: true, reason: "locked" as const };

  try {
    const enrolling = await prisma.game.findMany({
      where: {
        gameType: {
          in: [
            "FASTING",
            "CASTING",
            "FROOKIES",
            "ROOKIES",
            "SURVIVOR",
            "FASTING_BOT",
            "CASTING_BOT",
            "FROOKIES_BOT",
            "ROOKIES_BOT",
            "SURVIVOR_BOT",
          ],
        },
        state: "ENROLLING",
      },
      select: { id: true },
      take: 60,
    });
    let filled = 0;
    for (const g of enrolling) {
      try {
        const r = await maybeStartEnrollingLobby(g.id);
        if (r.ok && ("filled" in r || "started" in r || "attempted" in r)) filled++;
      } catch {}
    }

    const activeBotGames = await prisma.game.findMany({
      where: {
        gameType: {
          in: ["FASTING_BOT", "CASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT", "SURVIVOR_BOT"],
        },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE"] },
      },
      select: { id: true },
      take: 40,
    });
    for (const g of activeBotGames) {
      try {
        await performBotActions(g.id);
      } catch {}
    }

    const fastingBotDue = await prisma.game.findMany({
      where: {
        gameType: { in: ["FASTING_BOT", "FROOKIES_BOT", "ROOKIES_BOT"] },
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] },
        OR: [{ stateEndsAt: { not: null, lte: now } }, { stateEndsAt: null }],
      },
      select: { id: true },
      take: 50,
    });

    let fastingAdvanced = 0;
    for (const g of fastingBotDue) {
      try {
        const r = await advanceFastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) fastingAdvanced++;
      } catch (e) {
        console.error("FASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    const castingBotDue = await prisma.game.findMany({
      where: {
        gameType: "CASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [{ stateEndsAt: { not: null, lte: now } }, { stateEndsAt: null }],
      },
      select: { id: true },
      take: 50,
    });

    let castingAdvanced = 0;
    for (const g of castingBotDue) {
      try {
        const r = await advanceCastingBotIfDue(g.id);
        if ((r as any)?.advanced || (r as any)?.fixed) castingAdvanced++;
      } catch (e) {
        console.error("CASTING_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    const survivorBotDue = await prisma.game.findMany({
      where: {
        gameType: "SURVIVOR_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
        OR: [{ stateEndsAt: { not: null, lte: now } }, { stateEndsAt: null }],
      },
      select: { id: true },
      take: 30,
    });
    let survivorAdvanced = 0;
    for (const g of survivorBotDue) {
      try {
        const r = await advanceSurvivorIfDue(g.id);
        if ((r as { advanced?: boolean; fixed?: boolean }).advanced || (r as { fixed?: boolean }).fixed) {
          survivorAdvanced++;
        }
      } catch (e) {
        console.error("SURVIVOR_BOT advance failed", { gameId: g.id, err: String(e) });
      }
    }

    try {
      await applyCastingsPeriodicDecay({ gameType: "CASTING_BOT" });
    } catch (e) {
      console.error("CASTING_BOT periodic decay failed", { err: String(e) });
    }

    const castingBotActive = await prisma.game.findMany({
      where: {
        gameType: "CASTING_BOT",
        state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      },
      select: { id: true },
      take: 50,
    });
    for (const g of castingBotActive) {
      try {
        await maybeSpawnCastingsDrops(g.id);
      } catch (e) {
        console.error("CASTING_BOT drops failed", { gameId: g.id, err: String(e) });
      }
    }

    return {
      filled,
      fasting: { due: fastingBotDue.length, advanced: fastingAdvanced },
      casting: { due: castingBotDue.length, advanced: castingAdvanced },
      survivor: { due: survivorBotDue.length, advanced: survivorAdvanced },
    };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('cron_bot'))`;
  }
}

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runBotTick();
  return NextResponse.json({ ok: true, bot: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runBotTick();
  return NextResponse.json({ ok: true, bot: r });
}
