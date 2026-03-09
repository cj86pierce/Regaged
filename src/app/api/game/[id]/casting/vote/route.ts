import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Submit casting votes (pointsMap: { targetUserId -> points } for each nominee).
 * Nominees are determined at day end from mini game scores.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const voterUserId = await getCurrentUserId(req);
  if (!voterUserId) return bad("Unauthorized", 401);

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const pointsMap = body?.pointsMap;
  if (!pointsMap || typeof pointsMap !== "object") return bad("pointsMap required");

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

  const dayNumber = g.roundNumber;
  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeUserIds: true },
  });
  const nominees = new Set(day?.nomineeUserIds ?? []);
  if (nominees.size === 0) return bad("No nominees for this day", 400);

  const entries: { targetUserId: string; points: number }[] = [];
  for (const [targetUserId, rawPoints] of Object.entries(pointsMap)) {
    const tid = String(targetUserId).trim();
    if (!tid || !nominees.has(tid)) continue;
    const points = Number(rawPoints);
    if (!Number.isFinite(points) || points < 0) continue;
    if (tid === voterUserId) return bad("Cannot vote for yourself", 400);
    const targetGp = await prisma.gamePlayer.findUnique({
      where: { gameId_userId: { gameId, userId: tid } },
      select: { status: true },
    });
    if (!targetGp || targetGp.status !== "ACTIVE") return bad(`Target ${tid} must be active`, 400);
    entries.push({ targetUserId: tid, points });
  }
  if (entries.length === 0) return bad("No valid votes in pointsMap", 400);

  await prisma.$transaction(async (tx) => {
    await tx.castingVote.deleteMany({ where: { gameId, dayNumber, voterUserId } });
    for (const { targetUserId, points } of entries) {
      await tx.castingVote.create({
        data: { gameId, dayNumber, voterUserId, targetUserId, points },
      });
    }
    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
