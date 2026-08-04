import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

/** Submit / bump challenge score during challenge phases. */
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
      losingTribe: true,
    },
  });
  if (!game || (game.gameType !== "SURVIVOR" && game.gameType !== "SURVIVOR_BOT")) {
    return NextResponse.json({ error: "Not a Survivor game" }, { status: 404 });
  }

  const phase = game.survivorPhase ?? "";
  const challengePhases = ["TRIBE_CHALLENGE", "IMMUNITY", "INDIVIDUAL_CHALLENGE", "INDIVIDUAL_IMMUNITY"];
  if (!challengePhases.includes(phase) || game.state !== "ROUND_NOMINATE") {
    return NextResponse.json({ error: "Not in a challenge phase" }, { status: 400 });
  }
  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) {
    return NextResponse.json({ error: "Phase ended" }, { status: 400 });
  }

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true, tribe: true, challengeScore: true, sittingOut: true },
  });
  if (!gp || gp.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not in game" }, { status: 403 });
  }
  if (gp.sittingOut) {
    return NextResponse.json({ error: "Sitting out" }, { status: 403 });
  }
  if (phase === "IMMUNITY" && gp.tribe !== game.losingTribe) {
    return NextResponse.json({ error: "Only the losing tribe plays immunity" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const add = Math.min(50, Math.max(1, Math.trunc(Number(body?.score) || 10)));

  const updated = await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId } },
    data: { challengeScore: { increment: add } },
    select: { challengeScore: true },
  });

  return NextResponse.json({ ok: true, challengeScore: updated.challengeScore });
}
