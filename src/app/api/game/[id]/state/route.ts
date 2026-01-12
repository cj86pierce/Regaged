import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const playersRaw = await prisma.gamePlayer.findMany({
    where: { gameId },
    include: { user: { select: { username: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const roundResult = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
  });

  // Did I already submit my nominations this round?
  let myNomLocked: boolean | null = null;
  if (meUserId && game.state === "ROUND_NOMINATE") {
    const myNoms = await prisma.nomination.count({
      where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
    });
    myNomLocked = myNoms >= 2;
  }

  // Vote tally (ROUND_VOTE)
  let voteInfo: null | {
    nomineeAUserId: string;
    nomineeBUserId: string;
    votesA: number;
    votesB: number;
    myVoteTargetUserId: string | null;
  } = null;

  if (game.state === "ROUND_VOTE" && roundResult) {
    const votes = await prisma.evictionVote.findMany({
      where: { gameId, roundNumber: game.roundNumber },
      select: { voterUserId: true, targetUserId: true },
    });

    const a = roundResult.nomineeAUserId;
    const b = roundResult.nomineeBUserId;

    const votesA = votes.filter((v) => v.targetUserId === a).length;
    const votesB = votes.filter((v) => v.targetUserId === b).length;

    const myVoteTargetUserId =
      meUserId ? votes.find((v) => v.voterUserId === meUserId)?.targetUserId ?? null : null;

    voteInfo = { nomineeAUserId: a, nomineeBUserId: b, votesA, votesB, myVoteTargetUserId };
  }

  const messagesRaw = await prisma.gameMessage.findMany({
    where: { gameId, channel: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      user: { select: { username: true } },
      reactions: true,
    },
  });

  return NextResponse.json({
    ok: true,
    meUserId: meUserId ?? null,
    myNomLocked,
    game,
    nominees: roundResult
      ? { a: roundResult.nomineeAUserId, b: roundResult.nomineeBUserId, evictedUserId: roundResult.evictedUserId ?? null }
      : null,
    voteInfo,
    players: playersRaw.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      status: p.status,
      chatCount: p.chatCount,
      plusCount: p.plusCount,
      minusCount: p.minusCount,
      povWins: p.povWins,
    })),
    messages: messagesRaw.map((m) => {
      const plus = m.reactions.filter((r) => r.type === "PLUS").length;
      const minus = m.reactions.filter((r) => r.type === "MINUS").length;
      const myReaction = meUserId ? (m.reactions.find((r) => r.reactorUserId === meUserId)?.type ?? null) : null;

      return {
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        body: m.body,
        createdAt: m.createdAt,
        plus,
        minus,
        myReaction,
      };
    }),
  });
}
