import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function POST(req: Request) {
  // ✅ hard block in production (Vercel prod = "production")
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = (body?.gameId ?? "").toString().trim();
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // delete round data
    await tx.nomination.deleteMany({ where: { gameId } });
    await tx.evictionVote.deleteMany({ where: { gameId } });
    await tx.roundResult.deleteMany({ where: { gameId } });

    // delete chat messages (reactions cascade via FK)
    await tx.gameMessage.deleteMany({ where: { gameId } });

    // reset players but KEEP them in the game
    await tx.gamePlayer.updateMany({
      where: { gameId },
      data: {
        status: "ACTIVE",
        eliminatedAt: null,
        eliminatedPlace: null,
        lastActiveAt: new Date(),
        chatCount: 0,
        plusCount: 0,
        minusCount: 0,
        povWins: 0,
        lastHadPovRound: null,
      },
    });

    // reset game state back to lobby
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "ENROLLING",
        roundNumber: 0,
        povUserId: null,
        startsAt: null,
        stateEndsAt: null,
        completedAt: null,
      },
    });
  });

  return NextResponse.json({ ok: true, gameId });
}
