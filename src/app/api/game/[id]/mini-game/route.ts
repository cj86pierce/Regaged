/**
 * Unified minigame submit — routes by game type to casting or survivor scoring.
 */
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { pickMinigameForDay } from "@/lib/minigamePicker";
import { isMinigameId, toChallengeScore } from "@/lib/minigames/registry";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const minigameId = body?.minigameId;
  const raw = body?.raw ?? body?.score;
  if (!isMinigameId(minigameId)) return bad("Invalid minigameId");

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      state: true,
      roundNumber: true,
      survivorPhase: true,
      stateEndsAt: true,
    },
  });
  if (!g) return bad("Game not found", 404);

  const expected = pickMinigameForDay(gameId, g.roundNumber ?? 1);
  if (minigameId !== expected) return bad("Wrong minigame for this round", 400);

  const challengeScore =
    typeof raw === "number" ? null : toChallengeScore(minigameId, raw);
  if (challengeScore == null) return bad("Invalid score payload");

  const isSurvivor = g.gameType === "SURVIVOR" || g.gameType === "SURVIVOR_BOT";
  const isCastingStyle =
    g.gameType === "CASTING" ||
    g.gameType === "CASTING_BOT" ||
    g.gameType === "FROOKIES" ||
    g.gameType === "FROOKIES_BOT";

  if (!isSurvivor && !isCastingStyle) return bad("This game has no challenges", 400);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: {
      status: true,
      challengeScore: true,
      sittingOut: true,
      castingDayMiniGameScore: true,
    },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  if (isSurvivor) {
    const phase = g.survivorPhase ?? "";
    if (
      !["TRIBE_CHALLENGE", "INDIVIDUAL_CHALLENGE"].includes(phase) ||
      g.state !== "ROUND_NOMINATE"
    ) {
      return bad("Not in a challenge phase", 400);
    }
    if (g.stateEndsAt && Date.now() > g.stateEndsAt.getTime()) return bad("Phase ended", 400);
    if (gp.sittingOut) return bad("Sitting out this challenge", 403);

    const prev = gp.challengeScore ?? 0;
    const next = Math.max(prev, challengeScore);
    const improved = next > prev;
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: {
        ...(improved || prev === 0 ? { challengeScore: next } : {}),
        lastActiveAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      challengeScore: Math.max(prev, challengeScore),
      attemptScore: challengeScore,
      improved,
    });
  }

  if (g.state !== "ROUND_VOTE" && g.state !== "ROUND_NOMINATE") {
    return bad("Play during voting or nomination phase", 400);
  }

  const prev = gp.castingDayMiniGameScore ?? 0;
  const next = Math.max(prev, challengeScore);
  const improved = next > prev;
  await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId } },
    data: {
      ...(improved || prev === 0 ? { castingDayMiniGameScore: next } : {}),
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    challengeScore: next,
    attemptScore: challengeScore,
    improved,
  });
}
