import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { JURY_MIN_PLACE, JURY_MAX_PLACE } from "@/lib/frookiesJury";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const voterUserId = await getCurrentUserId(req);
  if (!voterUserId) return bad("Unauthorized", 401);

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const targetUserId = (body?.targetUserId ?? "").toString().trim();
  if (!targetUserId) return bad("targetUserId required");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true },
  });
  if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) {
    return bad("Not a Frookies game", 400);
  }
  if (game.state !== "JURY_VOTE") return bad("Jury voting is not open right now", 400);

  const voterGp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: voterUserId } },
    select: { status: true, eliminatedPlace: true },
  });
  if (!voterGp) return bad("Not in this game", 403);
  if (
    voterGp.status !== "ELIMINATED" ||
    !voterGp.eliminatedPlace ||
    voterGp.eliminatedPlace < JURY_MIN_PLACE ||
    voterGp.eliminatedPlace > JURY_MAX_PLACE
  ) {
    return bad("Only jury members (evicted 9th through 3rd place) can vote", 403);
  }

  const targetGp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: targetUserId } },
    select: { status: true },
  });
  if (!targetGp || targetGp.status !== "ACTIVE") return bad("Target must be a current finalist", 400);

  await prisma.juryVote.upsert({
    where: { gameId_voterUserId: { gameId, voterUserId } },
    update: { targetUserId },
    create: { gameId, voterUserId, targetUserId },
  });

  return NextResponse.json({ ok: true });
}
