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
    select: {
      id: true,
      number: true,
      gameType: true,
      state: true,
      roundNumber: true,
      stateEndsAt: true,
      povUserId: true,
    },
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
    orderBy: { joinedAt: "asc" },
  });

  const activeCount = playersRaw.filter((p) => p.status === "ACTIVE").length;
  const lobby =
    game.state === "ENROLLING"
      ? {
          current: activeCount,
          needed: Math.max(0, (game.gameType === "CASTING" ? 20 : 15) - activeCount),
        }
      : null;

  // messages
  const totalCount = await prisma.gameMessage.count({ where: { gameId, channel: "PUBLIC" } });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const messagesRaw = await prisma.gameMessage.findMany({
    where: { gameId, channel: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    include: { user: { select: { username: true } }, reactions: true },
  });

  // -----------------------
  // CASTING drop events (for messages on this page)
  // -----------------------
  let dropEvents: Record<
    string,
    { eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }
  > = {};

  if (game.gameType === "CASTING") {
    const dropIds = messagesRaw
      .map((m) => {
        const mm = /^\[CASTDROP:([a-z0-9]+)\]$/i.exec(m.body.trim());
        return mm ? mm[1] : null;
      })
      .filter((x): x is string => !!x);

    if (dropIds.length) {
      const events = await prisma.castingDropEvent.findMany({
        where: { id: { in: dropIds } },
        select: {
          id: true,
          claimedAt: true,
          options: { select: { slotIndex: true, kind: true } },
        },
      });

      for (const ev of events) {
        dropEvents[ev.id] = {
          eventId: ev.id,
          claimedAt: ev.claimedAt ? ev.claimedAt.toISOString() : null,
          options: ev.options.map((o) => ({ slotIndex: o.slotIndex, kind: o.kind as any })),
        };
      }
    }
  }

  // -----------------------
  // CASTING nominees + myVoted
  // -----------------------
  let castingNominees: string[] = [];
  let castingMyVoted = false;

  if (game.gameType === "CASTING" && game.state === "ROUND_VOTE") {
    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: game.roundNumber } },
      select: { nomineeUserIds: true },
    });

    castingNominees = day?.nomineeUserIds ?? [];

    if (meUserId) {
      const cnt = await prisma.castingVote.count({
        where: { gameId, dayNumber: game.roundNumber, voterUserId: meUserId },
      });
      castingMyVoted = cnt > 0;
    }
  }

  // -----------------------
  // FASTING-only nominee info (read only)
  // -----------------------
  let nomineeA: string | null = null;
  let nomineeB: string | null = null;
  let myNomLocked: boolean | null = null;
  let voteInfo: null | { myVoteTargetUserId: string | null } = null;

  if (game.gameType === "FASTING" && game.state !== "ENROLLING") {
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true, nomineeBUserId: true },
    });
    nomineeA = rr?.nomineeAUserId ?? null;
    nomineeB = rr?.nomineeBUserId ?? null;

    if (meUserId && game.state === "ROUND_NOMINATE") {
      const myNoms = await prisma.nomination.count({
        where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
      });
      myNomLocked = myNoms >= 2;
    }

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
  }

  return NextResponse.json({
    ok: true,
    meUserId: meUserId ?? null,

    // CASTING helpers
    dropEvents,
    casting: { nominees: castingNominees, myVoted: castingMyVoted },

    game: {
      id: game.id,
      number: game.number,
      gameType: game.gameType,
      state: game.state,
      roundNumber: game.roundNumber,
      stateEndsAt: game.stateEndsAt,
      povUserId: game.povUserId,
    },

    lobby,

    // FASTING-only fields (castings ignores)
    myNomLocked,
    voteInfo,

    pagination: { page, pageSize, totalPages, totalCount },

    players: playersRaw.map((p) => {
      const u = p.user;

      const isCastingNominee = game.gameType === "CASTING" && castingNominees.includes(p.userId);
      const isFastingNominee = !!(nomineeA && nomineeB && (p.userId === nomineeA || p.userId === nomineeB));

      return {
        userId: p.userId,
        username: u.username,
        status: p.status,
        lastActiveAt: p.lastActiveAt,
        eliminatedPlace: p.eliminatedPlace ?? null,

        checks: (p.plusCount ?? 0) - (p.minusCount ?? 0),
        health: p.health ?? 100,
        keys: p.keys ?? 0,

        isNominee: isCastingNominee || isFastingNominee,

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

      const isSystem =
        m.user.username === "__system__" ||
        /^\[SYSTEM\]/i.test(m.body) ||
        /^\[DROP:/i.test(m.body) ||
        /^\[CASTDROP:/i.test(m.body);

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
