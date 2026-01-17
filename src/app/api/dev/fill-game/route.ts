import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import bcrypt from "bcryptjs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function randStr(n = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: Request) {
  // ✅ dev secret gate
  const secret = req.headers.get("x-dev-secret") ?? "";
  if (!process.env.DEV_SECRET || secret !== process.env.DEV_SECRET) {
    return bad("Forbidden", 403);
  }

  const session = await getServerSession(authOptions);
  const meId = (session?.user as any)?.id as string | undefined;
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

  const existingPlayers = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: { userId: true, seatIndex: true },
  });
  const existingUserIds = new Set(existingPlayers.map((p) => p.userId));
  const takenSeats = new Set(existingPlayers.map((p) => p.seatIndex!).filter(Boolean));

  // Ensure you are in the game (seat assigned if missing)
  if (!existingUserIds.has(meId)) {
    const openSeats: number[] = [];
    for (let i = 1; i <= maxPlayers; i++) if (!takenSeats.has(i)) openSeats.push(i);
    const seat = openSeats.length ? openSeats[Math.floor(Math.random() * openSeats.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId, userId: meId, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });

    if (seat) takenSeats.add(seat);
  }

  // Fill remaining seats with dummy users
  let currentCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

  while (currentCount < maxPlayers) {
    const uname = `bot_${randStr(7)}`;
    const unameLower = uname.toLowerCase();
    const passwordHash = await bcrypt.hash("bot-password", 4);

    const u = await prisma.user.create({
      data: {
        username: uname,
        usernameLower: unameLower,
        passwordHash,
        // bots don’t need verified email
        emailVerifiedAt: null,
      },
      select: { id: true },
    });

    const openSeats: number[] = [];
    for (let i = 1; i <= maxPlayers; i++) if (!takenSeats.has(i)) openSeats.push(i);
    const seat = openSeats.length ? openSeats[Math.floor(Math.random() * openSeats.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId, userId: u.id, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });

    if (seat) takenSeats.add(seat);
    currentCount++;
  }

  return NextResponse.json({ ok: true, gameId, filledTo: maxPlayers });
}
