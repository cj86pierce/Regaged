import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") ?? "25") || 25));
  const skip = (page - 1) * pageSize;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, number: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const playersRaw = await prisma.gamePlayer.findMany({
    where: { gameId },
    include: { user: { select: { username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const totalCount = await prisma.gameMessage.count({ where: { gameId, channel: "PUBLIC" } });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const messagesRaw = await prisma.gameMessage.findMany({
    where: { gameId, channel: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    include: { user: { select: { username: true } }, reactions: true },
  });

  // Lobby info (filling)
  const lobby =
    game.state === "ENROLLING"
      ? {
          current: playersRaw.filter((p) => p.status === "ACTIVE").length,
          needed: Math.max(0, 15 - playersRaw.filter((p) => p.status === "ACTIVE").length),
        }
      : null;

  return NextResponse.json({
    ok: true,
    meUserId: meUserId ?? null,
    myNomLocked: null,
    game,
    nominees: null,
    voteInfo: null,
    lobby,
    pagination: { page, pageSize, totalPages, totalCount },
    players: playersRaw.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      status: p.status,
      lastActiveAt: p.lastActiveAt,
      eliminatedPlace: p.eliminatedPlace ?? null,
      chatCount: p.chatCount,
      plusCount: p.plusCount,
      minusCount: p.minusCount,
      povWins: p.povWins,
    })),
    messages: messagesRaw.map((m) => {
      const plus = m.reactions.filter((r) => r.type === "PLUS").length;
      const minus = m.reactions.filter((r) => r.type === "MINUS").length;
      const myReaction = meUserId ? (m.reactions.find((r) => r.reactorUserId === meUserId)?.type ?? null) : null;
      const isSystem = m.user.username === "__system__" || /^\[SYSTEM\]/i.test(m.body);

      return {
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        body: m.body,
        createdAt: m.createdAt,
        plus,
        minus,
        myReaction,
        isSystem,
      };
    }),
  });
}
