import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

async function maybeAdvanceGame(gameId: string) {
  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, stateEndsAt: true, povUserId: true },
  });
  if (!g) return;
  if (g.gameType !== "FASTING") return;

  if (g.state === "ROUND_NOMINATE" && !g.povUserId) {
    try {
      await assignFastingPov(gameId, false);
    } catch {}
  }

  if (!g.stateEndsAt) return;
  if (g.state !== "ROUND_NOMINATE" && g.state !== "ROUND_VOTE") return;
  if (g.stateEndsAt.getTime() > Date.now()) return;

  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return;

  try {
    const g2 = await prisma.game.findUnique({
      where: { id: gameId },
      select: { state: true, stateEndsAt: true, povUserId: true },
    });
    if (!g2?.stateEndsAt) return;
    if (g2.stateEndsAt.getTime() > Date.now()) return;

    if (g2.state === "ROUND_NOMINATE") {
      if (!g2.povUserId) {
        try {
          await assignFastingPov(gameId, false);
        } catch {}
      }
      await resolveFastingNominations(gameId);
    } else if (g2.state === "ROUND_VOTE") {
      await resolveFastingEviction(gameId);
    }
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId}))`;
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;

  const gForAdvance = await prisma.game.findUnique({
    where: { id: gameId },
    select: { state: true },
  });
  if (gForAdvance && gForAdvance.state !== "ENROLLING") {
    await maybeAdvanceGame(gameId);
  }

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

  const activeCount = playersRaw.filter((p) => p.status === "ACTIVE").length;
  const lobby = game.state === "ENROLLING" ? { current: activeCount, needed: Math.max(0, 15 - activeCount) } : null;

  const roundResult =
    game.state !== "ENROLLING"
      ? await prisma.roundResult.findUnique({
          where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
          select: { nomineeAUserId: true, nomineeBUserId: true, evictedUserId: true },
        })
      : null;

  const nomineeA = roundResult?.nomineeAUserId ?? null;
  const nomineeB = roundResult?.nomineeBUserId ?? null;

  // who has voted (only matters during ROUND_VOTE)
  let votedSet = new Set<string>();
  if (game.state === "ROUND_VOTE") {
    const votes = await prisma.evictionVote.findMany({
      where: { gameId, roundNumber: game.roundNumber },
      select: { voterUserId: true },
    });
    votedSet = new Set(votes.map((v) => v.voterUserId));
  }

  let myNomLocked: boolean | null = null;
  if (meUserId && game.state === "ROUND_NOMINATE") {
    const myNoms = await prisma.nomination.count({
      where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
    });
    myNomLocked = myNoms >= 2;
  }

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

    const votesA = votes.filter((v) => v.targetUserId === roundResult.nomineeAUserId).length;
    const votesB = votes.filter((v) => v.targetUserId === roundResult.nomineeBUserId).length;

    const myVoteTargetUserId =
      meUserId ? votes.find((v) => v.voterUserId === meUserId)?.targetUserId ?? null : null;

    voteInfo = {
      nomineeAUserId: roundResult.nomineeAUserId,
      nomineeBUserId: roundResult.nomineeBUserId,
      votesA,
      votesB,
      myVoteTargetUserId,
    };
  }

  const totalCount = await prisma.gameMessage.count({ where: { gameId, channel: "PUBLIC" } });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const messagesRaw = await prisma.gameMessage.findMany({
    where: { gameId, channel: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    include: { user: { select: { username: true } }, reactions: true },
  });

  return NextResponse.json({
    ok: true,
    meUserId: meUserId ?? null,
    myNomLocked,
    game,
    lobby,
    nominees: roundResult
      ? { a: roundResult.nomineeAUserId, b: roundResult.nomineeBUserId, evictedUserId: roundResult.evictedUserId ?? null }
      : null,
    voteInfo,
    pagination: { page, pageSize, totalPages, totalCount },
    players: playersRaw.map((p) => {
      const isNominee = !!(nomineeA && nomineeB && (p.userId === nomineeA || p.userId === nomineeB));
      const eligibleToVote =
        game.state === "ROUND_VOTE" && p.status === "ACTIVE" && !isNominee;
      const hasVoted = eligibleToVote ? votedSet.has(p.userId) : null;

      return {
        userId: p.userId,
        username: p.user.username,
        status: p.status,
        lastActiveAt: p.lastActiveAt,
        eliminatedPlace: p.eliminatedPlace ?? null,
        isNominee,
        hasVoted,
        chatCount: p.chatCount,
        plusCount: p.plusCount,
        minusCount: p.minusCount,
        povWins: p.povWins,
      };
    }),
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
