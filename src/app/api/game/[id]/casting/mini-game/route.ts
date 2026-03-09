/**
 * Submit mini game score for Castings.
 * Lower score = worse. At day end, 3 lowest become nominees.
 */
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const score = typeof body?.score === "number" ? body.score : Number(body?.score);
  if (!Number.isFinite(score) || score < 0) return bad("Invalid score (non-negative number)");

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!g || (g.gameType !== "CASTING" && g.gameType !== "CASTING_BOT"))
    return bad("Not a casting game", 400);
  if (g.state !== "ROUND_VOTE") return bad("Not in voting phase", 400);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId } },
    data: {
      castingDayMiniGameScore: score,
      lastActiveAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
