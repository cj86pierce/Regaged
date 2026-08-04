import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/games/feed
 * Light payload for Games hub: active games, past games, recent public chat.
 */
export async function GET() {
  const [active, past, chatRaw] = await Promise.all([
    prisma.game.findMany({
      where: { state: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, number: true, gameType: true, state: true },
    }),
    prisma.game.findMany({
      where: { state: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 20,
      select: {
        id: true,
        number: true,
        gameType: true,
        state: true,
        completedAt: true,
      },
    }),
    prisma.gameMessage.findMany({
      where: {
        channel: "PUBLIC",
        game: { state: { not: "COMPLETED" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        gameId: true,
        user: { select: { username: true } },
        game: { select: { number: true, gameType: true } },
      },
    }),
  ]);

  const chat = chatRaw.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    gameId: m.gameId,
    gameNumber: m.game.number,
    gameType: m.game.gameType,
    username: m.user.username,
  }));

  return NextResponse.json({
    active,
    past: past.map((g) => ({
      ...g,
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
    chat,
  });
}
