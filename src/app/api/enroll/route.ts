import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tryStartFastingGame } from "@/lib/gameEngine";

const FASTING_MAX = 15;

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ phone verification gate (inside handler)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneVerifiedAt: true },
  });
  if (!me?.phoneVerifiedAt) {
    return NextResponse.json(
      { error: "Phone verification required", redirect: "/verify-phone" },
      { status: 403 }
    );
  }

  // If user is already ACTIVE in any non-completed game, send them there
  const already = await prisma.gamePlayer.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    },
    select: { gameId: true },
  });
  if (already) return NextResponse.json({ ok: true, gameId: already.gameId });

  // Find or create ENROLLING FASTING lobby
  let lobby = await prisma.game.findFirst({
    where: { gameType: "FASTING", state: "ENROLLING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!lobby) {
    lobby = await prisma.game.create({
      data: { gameType: "FASTING", state: "ENROLLING", roundNumber: 0 },
      select: { id: true },
    });
  }

  // Seat assignment is handled in your enroll logic elsewhere if you already added it.
  // Join the lobby if not already
  const existing = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: lobby.id, userId } },
    select: { id: true },
  });

  if (!existing) {
    // Assign random open seat (1–15) if your schema has seatIndex
    const takenRows = await prisma.gamePlayer.findMany({
      where: { gameId: lobby.id, seatIndex: { not: null } },
      select: { seatIndex: true },
    });
    const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
    const open: number[] = [];
    for (let i = 1; i <= FASTING_MAX; i++) if (!taken.has(i)) open.push(i);
    const seat = open.length ? open[Math.floor(Math.random() * open.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId: lobby.id, userId, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });
  }

  // Try start if full
  await tryStartFastingGame(lobby.id);

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
