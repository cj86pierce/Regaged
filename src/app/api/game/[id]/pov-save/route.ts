/**
 * Frookies: POV holder saves before noms (ROUND_NOMINATE).
 * Rookies: POV holder secretly saves one nominee during ROUND_VOTE.
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
  if (!game) return bad("Game not found", 404);

  const isFrookies = game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT";
  const isRookies = game.gameType === "ROOKIES" || game.gameType === "ROOKIES_BOT";
  if (!isFrookies && !isRookies) return bad("POV save not available for this game", 400);
  if (game.povUserId !== userId) return bad("Only the POV holder can submit a save", 403);

  if (isFrookies && game.state !== "ROUND_NOMINATE") {
    return bad("POV save only during nomination phase", 400);
  }
  if (isRookies && game.state !== "ROUND_VOTE") {
    return bad("Rookies POV save only during voting phase", 400);
  }

  const saveUserId = targetUserId === null || targetUserId === "" ? userId : targetUserId;

  const isActive = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: saveUserId } },
    select: { status: true },
  });
  if (!isActive || isActive.status !== "ACTIVE") return bad("Cannot save a player not in the game or eliminated", 400);

  if (isRookies) {
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: {
        nomineeAUserId: true,
        nomineeBUserId: true,
        nomineeCUserId: true,
        nomineeDUserId: true,
      },
    });
    const nominees = [
      rr?.nomineeAUserId,
      rr?.nomineeBUserId,
      rr?.nomineeCUserId,
      rr?.nomineeDUserId,
    ].filter(Boolean) as string[];
    if (!nominees.includes(saveUserId)) return bad("Can only save a nominee", 400);
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { povSavedUserId: saveUserId },
  });

  return NextResponse.json({
    ok: true,
    savedUserId: saveUserId,
    secret: isRookies,
    message: saveUserId === userId ? "You saved yourself." : "You saved another player.",
  });
}
