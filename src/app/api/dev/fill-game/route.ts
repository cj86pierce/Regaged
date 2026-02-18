import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function randStr(n = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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

  let current = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

  while (current < maxPlayers) {
    const uname = `bot_${randStr(7)}`;
    const unameLower = uname.toLowerCase();
    const email = `${unameLower}@regaged.local`;
    const passwordHash = await bcrypt.hash("bot-password", 4);

    const u = await prisma.user.create({
      data: {
        username: uname,
        usernameLower: unameLower,
        passwordHash,
        email,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });

    await prisma.gamePlayer.create({ data: { gameId, userId: u.id, status: "ACTIVE" } });
    current++;
  }

  return NextResponse.json({ ok: true, gameId, filledTo: maxPlayers });
}
