import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Vote for one player to eliminate.
 * Nominees are determined at day end from mini game scores; votes for anyone count toward nominees.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const voterUserId = await getCurrentUserId(req);
  if (!voterUserId) return bad("Unauthorized", 401);

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const targetUserId = (body?.targetUserId ?? "").toString();
  if (!targetUserId) return bad("targetUserId required");

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!g || (g.gameType !== "CASTING" && g.gameType !== "CASTING_BOT"))
    return bad("Not a casting game", 400);
  if (g.state !== "ROUND_VOTE") return bad("Not in voting phase", 400);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: voterUserId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  const targetGp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: targetUserId } },
    select: { status: true },
  });
  if (!targetGp || targetGp.status !== "ACTIVE") return bad("Target must be an active player", 400);
  if (targetUserId === voterUserId) return bad("Cannot vote for yourself", 400);

  const dayNumber = g.roundNumber;

  await prisma.$transaction(async (tx) => {
    await tx.castingVote.deleteMany({ where: { gameId, dayNumber, voterUserId } });
    await tx.castingVote.create({
      data: { gameId, dayNumber, voterUserId, targetUserId, points: 1 },
    });
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
