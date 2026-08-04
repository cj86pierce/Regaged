/**
 * Submit mini-game raw metrics → uncapped Challenge Score (best-of-day).
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
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (
    !g ||
    (g.gameType !== "CASTING" &&
      g.gameType !== "CASTING_BOT" &&
      g.gameType !== "FROOKIES" &&
      g.gameType !== "FROOKIES_BOT")
  )
    return bad("Not a casting or frookies game", 400);
  if (g.state !== "ROUND_VOTE" && g.state !== "ROUND_NOMINATE")
    return bad("Play during voting or nomination phase", 400);

  const expected = pickMinigameForDay(gameId, g.roundNumber ?? 1);
  if (minigameId !== expected) return bad("Wrong minigame for today", 400);

  // Legacy: if client sent a bare number, wrap as { score } only for soft migration — reject; require raw object
  const challengeScore =
    typeof raw === "number"
      ? null
      : toChallengeScore(minigameId, raw);
  if (challengeScore == null) return bad("Invalid score payload");

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true, castingDayMiniGameScore: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  const prev = gp.castingDayMiniGameScore ?? 0;
  const next = Math.max(prev, challengeScore);
  const improved = next > prev;

  if (improved || prev === 0) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: {
        castingDayMiniGameScore: next,
        lastActiveAt: new Date(),
      },
    });
  } else {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { lastActiveAt: new Date() },
    });
  }

  return NextResponse.json({
    ok: true,
    challengeScore: next,
    attemptScore: challengeScore,
    improved,
  });
}
