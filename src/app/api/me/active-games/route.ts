import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ games: [] });

  const myGames = await prisma.gamePlayer.findMany({
    where: {
      userId,
      status: "ACTIVE",
      game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] } },
    },
    orderBy: { joinedAt: "desc" },
    take: 10,
    select: {
      gameId: true,
      game: { select: { number: true, gameType: true, state: true, roundNumber: true } },
    },
  });

  const games = myGames
    .filter((g) => g.game)
    .map((g) => ({
      gameId: g.gameId,
      number: g.game?.number ?? 0,
      gameType: g.game?.gameType ?? "Game",
      state: g.game?.state ?? "UNKNOWN",
      roundNumber: g.game?.roundNumber ?? 1,
    }));

  return NextResponse.json({ games });
}
