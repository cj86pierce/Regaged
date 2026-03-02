import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { catchUpCastingGame } from "@/lib/castingCatchUp";
import { catchUpCastingBotGame } from "@/lib/castingBotEngine";

/**
 * GET /api/game/[id]/nudge
 * For Casting/CastingBot: runs catch-up logic when timer expired.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.gameType !== "CASTING" && game.gameType !== "CASTING_BOT")
    return NextResponse.json({ ok: true, skipped: "not casting" });

  const inGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { id: true },
  });
  if (!inGame) return NextResponse.json({ error: "Not in this game" }, { status: 403 });

  try {
    const result =
      game.gameType === "CASTING_BOT"
        ? await catchUpCastingBotGame(gameId)
        : await catchUpCastingGame(gameId);
    return NextResponse.json({ ok: true, nudge: result });
  } catch (e) {
    console.error("Nudge failed", { gameId, err: String(e) });
    return NextResponse.json({ error: "Nudge failed" }, { status: 500 });
  }
}
