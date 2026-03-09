import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { fillGameWithBots } from "@/lib/botUsers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/dev/fill-game", hint: "Use POST with x-dev-secret" });
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-dev-secret") ?? "";
  if (!process.env.DEV_SECRET || secret !== process.env.DEV_SECRET) return bad("Forbidden", 403);

  const meId = await getCurrentUserId(req);
  if (!meId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const gameId = (body?.gameId ?? "").toString().trim();
  if (!gameId) return bad("gameId required");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true },
  });
  if (!game) return bad("Game not found", 404);
  if (game.state !== "ENROLLING") return bad("Game must be ENROLLING");

  const maxPlayers = game.gameType === "CASTING" ? 20 : 15;

  const meIn = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: meId } },
    select: { id: true },
  });
  if (!meIn) {
    await prisma.gamePlayer.create({ data: { gameId, userId: meId, status: "ACTIVE" } });
  }

  const added = await fillGameWithBots(gameId, maxPlayers);

  return NextResponse.json({ ok: true, gameId, filledTo: maxPlayers, added });
}
