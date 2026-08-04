import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      state: true,
      survivorPhase: true,
      stateEndsAt: true,
      roundNumber: true,
      losingTribe: true,
      survivorMerged: true,
    },
  });
  if (!game || (game.gameType !== "SURVIVOR" && game.gameType !== "SURVIVOR_BOT")) {
    return NextResponse.json({ error: "Not a Survivor game" }, { status: 404 });
  }
  if (game.state !== "ROUND_VOTE" || (game.survivorPhase !== "TRIBAL_COUNCIL" && game.survivorPhase !== "VOTE")) {
    return NextResponse.json({ error: "Not voting" }, { status: 400 });
  }
  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) {
    return NextResponse.json({ error: "Voting ended" }, { status: 400 });
  }

  const voter = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true, tribe: true, hasImmunity: true },
  });
  if (!voter || voter.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not in game" }, { status: 403 });
  }
  if (!game.survivorMerged && voter.tribe !== game.losingTribe) {
    return NextResponse.json({ error: "Only the losing tribe votes" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  if (!targetUserId) return NextResponse.json({ error: "Pick a target" }, { status: 400 });

  const target = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: targetUserId } },
    select: { status: true, tribe: true, hasImmunity: true },
  });
  if (!target || target.status !== "ACTIVE" || target.hasImmunity) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  if (!game.survivorMerged && target.tribe !== game.losingTribe) {
    return NextResponse.json({ error: "Must vote someone from your tribe" }, { status: 400 });
  }
  if (targetUserId === userId) {
    return NextResponse.json({ error: "Cannot vote yourself" }, { status: 400 });
  }

  await prisma.evictionVote.upsert({
    where: {
      gameId_roundNumber_voterUserId: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId: userId,
      },
    },
    create: {
      gameId,
      roundNumber: game.roundNumber,
      voterUserId: userId,
      targetUserId,
    },
    update: { targetUserId },
  });

  return NextResponse.json({ ok: true });
}
