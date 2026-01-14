import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { assignFastingPov } from "@/lib/fastingPov";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { resolveFastingEviction } from "@/lib/fastingVotes";

async function tickDueFastings() {
  const now = new Date();

  // 1) Advance any due FASTING games
  const due = await prisma.game.findMany({
    where: {
      gameType: "FASTING",
      state: { in: ["ROUND_NOMINATE", "ROUND_VOTE"] },
      stateEndsAt: { not: null, lte: now },
    },
    select: { id: true, state: true },
  });

  for (const g of due) {
    try {
      if (g.state === "ROUND_NOMINATE") {
        await assignFastingPov(g.id);
        await resolveFastingNominations(g.id);
      } else if (g.state === "ROUND_VOTE") {
        await resolveFastingEviction(g.id);
      }
    } catch {
      // ignore so one bad game doesn't stop ticking
    }
  }

  // 2) Ensure POV exists for any nominate games missing it (even if not due yet)
  const needPov = await prisma.game.findMany({
    where: {
      gameType: "FASTING",
      state: "ROUND_NOMINATE",
      povUserId: null,
    },
    select: { id: true },
  });

  for (const g of needPov) {
    try {
      await assignFastingPov(g.id);
    } catch {}
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  const session = await getServerSession(authOptions);
  const meUserId = (session?.user as any)?.id as string | undefined;

  // ✅ Hobby-friendly “background progression”
  // Any viewer advances all due games.
  await tickDueFastings();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") ?? "25") || 25));
  const skip = (page - 1) * pageSize;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, number: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true, povUserId: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const playersRaw = await prisma.gamePlayer.findMany({
    where: { gameId },
    include: {
      user: {
        select: {
          username: true,

          bodyStyle: true,
          hairStyle: true,
          eyesStyle: true,
          mouthStyle: true,
          shirtStyle: true,
          accessoryStyle: true,

          bodyColor: true,
          hairColor: true,
          eyeColor: true,
          mouthColor: true,
          shirtColor: true,
          accessoryColor: true,
        },
      },
    },
    orderBy: [{ seatIndex: "asc" }, { joinedAt: "asc" }],
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

  let myNomLocked: boolean | null = null;
  if (meUserId && game.state === "ROUND_NOMINATE") {
    const myNoms = await prisma.nomination.count({
      where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
    });
    myNomLocked = myNoms >= 2;
  }

  let voteInfo: null | { myVoteTargetUserId: string | null } = null;
  if (game.state === "ROUND_VOTE") {
    const myVoteTargetUserId = meUserId
      ? (
          await prisma.evictionVote.findFirst({
            where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
            select: { targetUserId: true },
          })
        )?.targetUserId ?? null
      : null;

    voteInfo = { myVoteTargetUserId };
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
    game: {
      id: game.id,
      number: game.number,
      state: game.state,
      roundNumber: game.roundNumber,
      povUserId: game.povUserId,
      stateEndsAt: game.stateEndsAt,
    },
    lobby,
    voteInfo,
    pagination: { page, pageSize, totalPages, totalCount },
    players: playersRaw.map((p) => {
      const u = p.user;
      return {
        userId: p.userId,
        username: u.username,
        status: p.status,
        lastActiveAt: p.lastActiveAt,
        eliminatedPlace: p.eliminatedPlace ?? null,
        isNominee: !!(nomineeA && nomineeB && (p.userId === nomineeA || p.userId === nomineeB)),
        avatar: {
          bodyStyle: u.bodyStyle,
          hairStyle: u.hairStyle,
          eyesStyle: u.eyesStyle,
          mouthStyle: u.mouthStyle,
          shirtStyle: u.shirtStyle,
          accessoryStyle: u.accessoryStyle,
          bodyColor: u.bodyColor,
          hairColor: u.hairColor,
          eyeColor: u.eyeColor,
          mouthColor: u.mouthColor,
          shirtColor: u.shirtColor,
          accessoryColor: u.accessoryColor,
        },
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
