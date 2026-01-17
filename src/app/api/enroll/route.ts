import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tryStartFastingGame } from "@/lib/gameEngine";
// We'll add tryStartCastingsGame later; for now we can reuse tryStartFastingGame start logic or just start when full.
import { tryStartCastingsGame } from "@/lib/gameEngineCastings"; // create stub next step

const FASTING_MAX = 15;
const CASTING_MAX = 20;

type GameType = "FASTING" | "CASTING";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ require email verification to enroll
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!me?.emailVerifiedAt) {
    return NextResponse.json({ error: "Email verification required", redirect: "/profile/edit" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const gameType = (body?.gameType ?? "FASTING") as GameType;

  if (gameType !== "FASTING" && gameType !== "CASTING") {
    return NextResponse.json({ error: "Invalid gameType" }, { status: 400 });
  }

  const MAX = gameType === "CASTING" ? CASTING_MAX : FASTING_MAX;

  // If user already ACTIVE in any running game, send them there
  const already = await prisma.gamePlayer.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    },
    select: { gameId: true },
  });
  if (already) return NextResponse.json({ ok: true, gameId: already.gameId });

  // Find or create lobby for this gameType
  let lobby = await prisma.game.findFirst({
    where: { gameType, state: "ENROLLING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!lobby) {
    lobby = await prisma.game.create({
      data: { gameType, state: "ENROLLING", roundNumber: 0 },
      select: { id: true },
    });
  }

  // Join lobby if not already
  const existing = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: lobby.id, userId } },
    select: { id: true },
  });

  if (!existing) {
    // Random open seat 1..MAX (if seatIndex exists)
    const takenRows = await prisma.gamePlayer.findMany({
      where: { gameId: lobby.id, seatIndex: { not: null } },
      select: { seatIndex: true },
    });

    const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
    const open: number[] = [];
    for (let i = 1; i <= MAX; i++) if (!taken.has(i)) open.push(i);
    const seat = open.length ? open[Math.floor(Math.random() * open.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId: lobby.id, userId, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });
  }

  // Start if full
  if (gameType === "FASTING") {
    await tryStartFastingGame(lobby.id);
  } else {
    await tryStartCastingsGame(lobby.id);
  }

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
