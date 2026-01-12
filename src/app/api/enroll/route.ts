import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";

const FASTING_MAX = 15;
const FASTING_NOM_MS = 2 * 60 * 1000;

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If user is already ACTIVE in any non-completed game, send them there
  const already = await prisma.gamePlayer.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    },
    select: { gameId: true },
  });
  if (already) return NextResponse.json({ ok: true, gameId: already.gameId, note: "Already in a game" });

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

  // Add user to lobby if not already
  const existing = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: lobby.id, userId } },
  });
  if (!existing) {
    await prisma.gamePlayer.create({
      data: { gameId: lobby.id, userId, status: "ACTIVE" },
    });
  }

  // Count lobby size
  const count = await prisma.gamePlayer.count({
    where: { gameId: lobby.id, status: "ACTIVE" },
  });

  // If full, start the game immediately
  if (count >= FASTING_MAX) {
    await prisma.game.update({
      where: { id: lobby.id },
      data: {
        state: "ROUND_NOMINATE",
        roundNumber: 1,
        startsAt: new Date(),
        stateEndsAt: new Date(Date.now() + FASTING_NOM_MS),
      },
    });

    // Assign POV right away
    try {
      await assignFastingPov(lobby.id, false);
    } catch {}
  }

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
