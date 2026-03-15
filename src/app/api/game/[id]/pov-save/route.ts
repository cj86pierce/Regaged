/**
 * Frookies: POV holder submits who they save (themselves or one other player) before noms.
 * POST body: { targetUserId: string | null }. null = save self.
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
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, povUserId: true },
  });
  if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT"))
    return bad("Not a Frookies game", 400);
  if (game.state !== "ROUND_NOMINATE") return bad("POV save only during nomination phase", 400);
  if (game.povUserId !== userId) return bad("Only the POV holder can submit a save", 403);

  const saveUserId = targetUserId === null || targetUserId === "" ? userId : targetUserId;

  const isActive = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: saveUserId } },
    select: { status: true },
  });
  if (!isActive || isActive.status !== "ACTIVE") return bad("Cannot save a player not in the game or eliminated", 400);

  await prisma.game.update({
    where: { id: gameId },
    data: { povSavedUserId: saveUserId },
  });

  return NextResponse.json({
    ok: true,
    savedUserId: saveUserId,
    message: saveUserId === userId ? "You saved yourself." : "You saved another player.",
  });
}
