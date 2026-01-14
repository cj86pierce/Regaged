import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tryStartFastingGame } from "@/lib/gameEngine";

const FASTING_MAX = 15;

function pickRandomOpenSeat(taken: Set<number>) {
  const open: number[] = [];
  for (let i = 1; i <= FASTING_MAX; i++) if (!taken.has(i)) open.push(i);
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)];
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Already in an active game?
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

  // Join + assign seat in a transaction to avoid collisions
  await prisma.$transaction(async (tx) => {
    const existing = await tx.gamePlayer.findUnique({
      where: { gameId_userId: { gameId: lobby!.id, userId } },
      select: { id: true, seatIndex: true },
    });

    if (existing) {
      // If somehow seatIndex is missing, assign now
      if (!existing.seatIndex) {
        const takenRows = await tx.gamePlayer.findMany({
          where: { gameId: lobby!.id, seatIndex: { not: null } },
          select: { seatIndex: true },
        });
        const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
        const seat = pickRandomOpenSeat(taken);
        if (seat) {
          await tx.gamePlayer.update({
            where: { id: existing.id },
            data: { seatIndex: seat },
          });
        }
      }
      return;
    }

    const takenRows = await tx.gamePlayer.findMany({
      where: { gameId: lobby!.id, seatIndex: { not: null } },
      select: { seatIndex: true },
    });
    const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
    const seat = pickRandomOpenSeat(taken);
    if (!seat) throw new Error("No seats available");

    await tx.gamePlayer.create({
      data: { gameId: lobby!.id, userId, status: "ACTIVE", seatIndex: seat },
    });
  });

  // Try to start if full
  await tryStartFastingGame(lobby.id);

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
