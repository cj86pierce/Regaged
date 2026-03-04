import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { catchUpCastingGame } from "@/lib/castingCatchUp";
import { catchUpCastingBotGame } from "@/lib/castingBotEngine";
import { advanceFastingIfDue } from "@/lib/fastingAdvance";
import { advanceFastingBotIfDue } from "@/lib/fastingBotAdvance";

/**
 * GET /api/game/[id]/nudge
 * Advances the game when timer expired (Casting, Fasting, and bot modes).
 * ?force=1 = treat as due (for manual "Timer ended? Nudge" so we advance despite clock skew).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const inGame = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { id: true },
  });
  if (!inGame) return NextResponse.json({ error: "Not in this game" }, { status: 403 });

  try {
    let result: unknown;
    if (game.gameType === "CASTING") {
      result = await catchUpCastingGame(gameId, { forceDue: force });
    } else if (game.gameType === "CASTING_BOT") {
      result = await catchUpCastingBotGame(gameId, { forceDue: force });
    } else if (game.gameType === "FASTING") {
      result = await advanceFastingIfDue(gameId);
    } else if (game.gameType === "FASTING_BOT") {
      result = await advanceFastingBotIfDue(gameId);
    } else {
      return NextResponse.json({ ok: true, skipped: "no nudge for this game type" });
    }
    const nudge = result as { ok?: boolean; skipped?: boolean; lastResult?: string; reason?: string; state?: string; round?: number; advanced?: boolean; loops?: number };
    if (game.gameType === "CASTING" || game.gameType === "CASTING_BOT") {
      console.log("[nudge]", { gameId: gameId.slice(0, 8), gameType: game.gameType, force, nudge });
    }
    return NextResponse.json({
      ok: true,
      gameType: game.gameType,
      nudge: result,
      day1Result: nudge?.lastResult,
      skipped: nudge?.skipped ? nudge.reason ?? "lock" : undefined,
      state: nudge?.state,
      round: nudge?.round,
    });
  } catch (e) {
    console.error("Nudge failed", { gameId, err: String(e) });
    return NextResponse.json({ error: "Nudge failed" }, { status: 500 });
  }
}
