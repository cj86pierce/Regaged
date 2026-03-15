import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { advanceCastingIfDue } from "@/lib/castingAdvance";
import { advanceCastingBotIfDue } from "@/lib/castingBotAdvance";
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
      result = await advanceCastingIfDue(gameId, { forceDue: force });
    } else if (game.gameType === "CASTING_BOT") {
      result = await advanceCastingBotIfDue(gameId, { forceDue: force });
    } else if (game.gameType === "FASTING" || game.gameType === "FROOKIES" || game.gameType === "ROOKIES") {
      result = await advanceFastingIfDue(gameId);
    } else if (game.gameType === "FASTING_BOT") {
      result = await advanceFastingBotIfDue(gameId);
    } else {
      return NextResponse.json({ ok: true, skipped: "no nudge for this game type" });
    }
    const nudge = result as { ok?: boolean; skipped?: boolean; reason?: string; advanced?: string; fixed?: string };
    return NextResponse.json({
      ok: true,
      gameType: game.gameType,
      nudge: result,
      advanced: !!nudge?.advanced || !!nudge?.fixed,
      skipped: nudge?.skipped ? nudge.reason ?? "lock" : undefined,
    });
  } catch (e) {
    console.error("Nudge failed", { gameId, err: String(e) });
    return NextResponse.json({ error: "Nudge failed" }, { status: 500 });
  }
}
