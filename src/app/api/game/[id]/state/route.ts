import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { touchUser } from "@/lib/touchUser";
import { getSlotDesignsForUserIds, type SlotDesignsMap } from "@/lib/avatarSlotDesigns";
import { isLiveGameType, lobbyReadyAtFromCreated } from "@/lib/lobbyTiming";

const presenceTouchAt = new Map<string, number>();
const PRESENCE_TOUCH_EVERY_MS = 60_000;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  const meUserId = await getCurrentUserId(req);

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
      createdAt: true,
      povUserId: true,
      hohUserId: true,
      povSavedUserId: true,
      frookiesPhase: true,
      survivorPhase: true,
      survivorMerged: true,
      survivorIsMerge: true,
      losingTribe: true,
      tribeAFood: true,
      tribeAWater: true,
      tribeAFire: true,
      tribeBFood: true,
      tribeBWater: true,
      tribeBFire: true,
      tribeAWeather: true,
      tribeBWeather: true,
      tribeAGatherReadyAt: true,
      tribeBGatherReadyAt: true,
      tribeARainUntil: true,
      tribeBRainUntil: true,
      tribeAFireUntil: true,
      tribeBFireUntil: true,
    },
  });

  // -----------------------
  // FROOKIES jury phase
  // -----------------------
  let jury: {
    finalists: { userId: string; username: string }[];
    isJuror: boolean;
    myVoteTargetUserId: string | null;
    voteCount: number;
    jurorCount: number;
  } | null = null;

  if (
    game &&
    (game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT") &&
    game.state === "JURY_VOTE"
  ) {
    const { JURY_MIN_PLACE, JURY_MAX_PLACE } = await import("@/lib/frookiesJury");
    const [finalistRows, jurorCount, voteCount, myVote] = await Promise.all([
      prisma.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, user: { select: { username: true } } },
      }),
      prisma.gamePlayer.count({
        where: { gameId, status: "ELIMINATED", eliminatedPlace: { gte: JURY_MIN_PLACE, lte: JURY_MAX_PLACE } },
      }),
      prisma.juryVote.count({ where: { gameId } }),
      meUserId
        ? prisma.juryVote.findUnique({
            where: { gameId_voterUserId: { gameId, voterUserId: meUserId } },
            select: { targetUserId: true },
          })
        : null,
    ]);

    const myPlayer = meUserId
      ? await prisma.gamePlayer.findUnique({
          where: { gameId_userId: { gameId, userId: meUserId } },
          select: { status: true, eliminatedPlace: true },
        })
      : null;
    const isJuror = !!(
      myPlayer &&
      myPlayer.status === "ELIMINATED" &&
      myPlayer.eliminatedPlace &&
      myPlayer.eliminatedPlace >= JURY_MIN_PLACE &&
      myPlayer.eliminatedPlace <= JURY_MAX_PLACE
    );

    jury = {
      finalists: finalistRows.map((f) => ({ userId: f.userId, username: f.user.username })),
      isJuror,
      myVoteTargetUserId: myVote?.targetUserId ?? null,
      voteCount,
      jurorCount,
    };
  }
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  // Having the tab open counts as activity - fire and forget so response is faster
  const isActiveGame =
    game.gameType === "CASTING" ||
    game.gameType === "FASTING" ||
    game.gameType === "FASTING_BOT" ||
    game.gameType === "CASTING_BOT" ||
    game.gameType === "FROOKIES" ||
    game.gameType === "ROOKIES" ||
    game.gameType === "FROOKIES_BOT" ||
    game.gameType === "ROOKIES_BOT" ||
    game.gameType === "SURVIVOR" ||
    game.gameType === "SURVIVOR_BOT";
  if (meUserId && isActiveGame) {
    const touchKey = `${gameId}:${meUserId}`;
    const last = presenceTouchAt.get(touchKey) ?? 0;
    const nowMs = Date.now();
    if (nowMs - last >= PRESENCE_TOUCH_EVERY_MS) {
      presenceTouchAt.set(touchKey, nowMs);
      // Always bump User.lastSeenAt (owner online); game seat activity is separate.
      void touchUser(meUserId).catch(() => {});
      void prisma.gamePlayer
        .updateMany({
          where: { gameId, userId: meUserId, status: "ACTIVE" },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }
  }

  const myGp =
    meUserId
      ? await prisma.gamePlayer.findUnique({
          where: { gameId_userId: { gameId, userId: meUserId } },
          select: { tribe: true, status: true },
        })
      : null;

  const isSurvivor = game.gameType === "SURVIVOR" || game.gameType === "SURVIVOR_BOT";
  if (isSurvivor && game.state !== "ENROLLING" && game.state !== "COMPLETED") {
    const { syncCampTimers } = await import("@/lib/survivor/camp");
    await syncCampTimers(gameId).catch(() => null);
    const camp = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        tribeAFood: true,
        tribeAWater: true,
        tribeAFire: true,
        tribeBFood: true,
        tribeBWater: true,
        tribeBFire: true,
        tribeAWeather: true,
        tribeBWeather: true,
        tribeAGatherReadyAt: true,
        tribeBGatherReadyAt: true,
        tribeARainUntil: true,
        tribeBRainUntil: true,
        tribeAFireUntil: true,
        tribeBFireUntil: true,
      },
    });
    if (camp) Object.assign(game, camp);
  }
  // Tribal + merge stages both use two tribe screens (A/B). Never one 20-wide "merged camp".
  const tribeLobbies =
    isSurvivor &&
    !game.survivorMerged &&
    game.state !== "ENROLLING" &&
    game.state !== "COMPLETED";

  const requestedTribe = (url.searchParams.get("tribe") ?? "").toUpperCase();
  let myTribe: string | null =
    myGp?.tribe === "A" || myGp?.tribe === "B" || myGp?.tribe === "MERGED" ? myGp.tribe : null;

  // ?tribe=A|B switches which tribe lobby you view (chat/roster). Default: your own tribe.
  let viewTribe: string | null = null;
  if (tribeLobbies) {
    if (requestedTribe === "A" || requestedTribe === "B") {
      viewTribe = requestedTribe;
    } else if (myTribe === "A" || myTribe === "B") {
      viewTribe = myTribe;
    } else {
      viewTribe = "A";
    }
  } else if (isSurvivor && game.survivorMerged) {
    viewTribe = "MERGED";
  }

  const messageWhere =
    tribeLobbies && (viewTribe === "A" || viewTribe === "B")
      ? {
          gameId,
          channel: "PUBLIC" as const,
          OR: [{ tribe: viewTribe }, { tribe: null }],
        }
      : { gameId, channel: "PUBLIC" as const };

  const [playersRaw, totalCount, messagesRaw] = await Promise.all([
    prisma.gamePlayer.findMany({
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
    }),
    prisma.gameMessage.count({ where: messageWhere }),
    prisma.gameMessage.findMany({
      where: messageWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: { select: { username: true } }, reactions: true },
    }),
  ]);

  const activeCount = playersRaw.filter((p) => p.status === "ACTIVE").length;
  const lobbyCap =
    game.gameType === "CASTING" || game.gameType === "CASTING_BOT"
      ? 20
      : game.gameType === "SURVIVOR" || game.gameType === "SURVIVOR_BOT"
        ? game.survivorIsMerge
          ? 10
          : 20
        : 15;
  // Bot-fill countdown only on live lobbies (practice *_BOT fills instantly).
  const showBotFillTimer =
    game.state === "ENROLLING" &&
    isLiveGameType(game.gameType) &&
    !game.survivorIsMerge;

  const lobby =
    game.state === "ENROLLING"
      ? {
          current: activeCount,
          needed: Math.max(0, lobbyCap - activeCount),
          botsFillAt: showBotFillTimer
            ? lobbyReadyAtFromCreated(game.createdAt).toISOString()
            : null,
          lobbyReadyAt: showBotFillTimer
            ? lobbyReadyAtFromCreated(game.createdAt).toISOString()
            : null,
        }
      : null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // -----------------------
  // CASTING drop events (for messages on this page)
  // -----------------------
  const dropEvents: Record<
    string,
    { eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }
  > = {};

  let carePackages: Array<{
    eventId: string;
    claimedAt: string | null;
    options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[];
  }> = [];

  if ((game.gameType === "CASTING" || game.gameType === "CASTING_BOT") && meUserId) {
    const cp = await prisma.castingDropEvent.findMany({
      where: {
        gameId,
        dropType: "CARE_PACKAGE",
        recipientUserId: meUserId,
        claimedAt: null,
      },
      select: {
        id: true,
        claimedAt: true,
        options: { select: { slotIndex: true, kind: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    carePackages = cp.map((ev) => ({
      eventId: ev.id,
      claimedAt: ev.claimedAt ? ev.claimedAt.toISOString() : null,
      options: ev.options
        .map((o) => ({ slotIndex: o.slotIndex, kind: o.kind as "APPLE" | "KEY" | "POISON" }))
        .sort((a, b) => a.slotIndex - b.slotIndex),
    }));
  }

  if (game.gameType === "CASTING" || game.gameType === "CASTING_BOT") {
    const dropIds = messagesRaw
      .map((m) => {
        const mm = /\[CASTDROP:([a-z0-9_-]+)\]/i.exec(m.body.trim());
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
        const opts = ev.options
          .map((o) => ({ slotIndex: o.slotIndex, kind: o.kind as "APPLE" | "KEY" | "POISON" }))
          .sort((a, b) => a.slotIndex - b.slotIndex);
        dropEvents[ev.id] = {
          eventId: ev.id,
          claimedAt: ev.claimedAt ? ev.claimedAt.toISOString() : null,
          options: opts,
        };
      }
    }
  }

  // -----------------------
  // CASTING nominees + myVoted + myVoteTarget
  // -----------------------
  let castingNominees: string[] = [];
  let castingMyVoted = false;
  let castingMyVoteTargetUserId: string | null = null;

  if ((game.gameType === "CASTING" || game.gameType === "CASTING_BOT") && game.state === "ROUND_VOTE") {
    const day = await prisma.castingDayResult.findUnique({
      where: { gameId_dayNumber: { gameId, dayNumber: game.roundNumber } },
      select: { nomineeUserIds: true },
    });

    castingNominees = day?.nomineeUserIds ?? [];

    if (meUserId) {
      const myVote = await prisma.castingVote.findFirst({
        where: { gameId, dayNumber: game.roundNumber, voterUserId: meUserId },
        select: { targetUserId: true },
      });
      castingMyVoted = !!myVote;
      castingMyVoteTargetUserId = myVote?.targetUserId ?? null;
    }
  }

  // -----------------------
  // FASTING-only nominee info (read only)
  // -----------------------
  let nomineeA: string | null = null;
  let nomineeB: string | null = null;
  let nomineeC: string | null = null;
  let nomineeD: string | null = null;
  let myNomLocked: boolean | null = null;
  let voteInfo: null | { myVoteTargetUserId?: string | null; myRankings?: Record<string, number> } = null;

  if ((game.gameType === "FASTING" || game.gameType === "FASTING_BOT" || game.gameType === "FROOKIES" || game.gameType === "ROOKIES" || game.gameType === "FROOKIES_BOT" || game.gameType === "ROOKIES_BOT") && game.state !== "ENROLLING") {
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: {
        nomineeAUserId: true,
        nomineeBUserId: true,
        nomineeCUserId: true,
        nomineeDUserId: true,
      },
    });
    nomineeA = rr?.nomineeAUserId ?? null;
    nomineeB = rr?.nomineeBUserId ?? null;
    nomineeC = rr?.nomineeCUserId ?? null;
    nomineeD = rr?.nomineeDUserId ?? null;

    if (meUserId && game.state === "ROUND_NOMINATE") {
      const myNoms = await prisma.nomination.count({
        where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
      });
      myNomLocked = game.gameType === "ROOKIES" ? myNoms >= 2 : myNoms >= 2;
    }

    if (game.state === "ROUND_VOTE") {
      const isRookies =
        (game.gameType === "ROOKIES" || game.gameType === "ROOKIES_BOT") && !!nomineeC;
      if (isRookies && meUserId) {
        const myRankingVotes = await prisma.rankingVote.findMany({
          where: { gameId, roundNumber: game.roundNumber, voterUserId: meUserId },
          select: { targetUserId: true, points: true },
        });
        const myRankings: Record<string, number> = {};
        for (const v of myRankingVotes) myRankings[v.targetUserId] = v.points;
        voteInfo = { myRankings: Object.keys(myRankings).length ? myRankings : undefined };
      } else {
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
  }

  return NextResponse.json({
    ok: true,
    meUserId: meUserId ?? null,

    // CASTING helpers
    dropEvents,
    carePackages,
    casting: {
      nominees: castingNominees,
      myVoted: castingMyVoted,
      myVoteTargetUserId: castingMyVoteTargetUserId,
    },

    jury,

    game: {
      id: game.id,
      number: game.number,
      gameType: game.gameType,
      state: game.state,
      roundNumber: game.roundNumber,
      createdAt: game.createdAt.toISOString(),
      stateEndsAt: game.state === "COMPLETED" ? null : game.stateEndsAt,
      // Classic Rookies POV is secret — only reveal to the holder
      povUserId:
        game.gameType === "ROOKIES" || game.gameType === "ROOKIES_BOT"
          ? meUserId && game.povUserId === meUserId
            ? game.povUserId
            : null
          : game.povUserId,
      hohUserId: game.hohUserId ?? undefined,
      povSavedUserId:
        game.gameType === "ROOKIES" || game.gameType === "ROOKIES_BOT"
          ? meUserId && game.povUserId === meUserId
            ? game.povSavedUserId ?? undefined
            : undefined
          : game.povSavedUserId ?? undefined,
      frookiesPhase: game.frookiesPhase ?? undefined,
      survivorPhase: game.survivorPhase ?? undefined,
      survivorMerged: game.survivorMerged ?? false,
      survivorIsMerge: game.survivorIsMerge ?? false,
      losingTribe: game.losingTribe ?? undefined,
      survivorSupplies: (await import("@/lib/survivor/camp")).campPublicView(game),
    },

    // Survivor tribe lobbies
    myTribe,
    viewTribe,
    tribeLobbies,

    nomineeCUserId: nomineeC ?? undefined,
    nomineeDUserId: nomineeD ?? undefined,

    lobby,

    // FASTING-only fields (castings ignores)
    myNomLocked,
    voteInfo,

    pagination: { page, pageSize, totalPages, totalCount },

    players: await (async () => {
      const playerIds = playersRaw.map((p) => p.userId);
      const slotDesignsByUser: Record<string, SlotDesignsMap> = await getSlotDesignsForUserIds(
        playerIds
      ).catch(() => ({}));
      return playersRaw.map((p) => {
        const u = p.user;
        const slotDesigns = (slotDesignsByUser as Record<string, SlotDesignsMap>)[p.userId];

        const isCastingNominee =
        (game.gameType === "CASTING" || game.gameType === "CASTING_BOT") &&
        castingNominees.includes(p.userId);
      const fastingNomineeIds = [nomineeA, nomineeB, nomineeC, nomineeD].filter(Boolean) as string[];
      const isFastingNominee = fastingNomineeIds.includes(p.userId);

      return {
        userId: p.userId,
        username: u.username,
        status: p.status,
        lastActiveAt: p.lastActiveAt,
        eliminatedPlace: p.eliminatedPlace ?? null,

        checks: (p.plusCount ?? 0) - (p.minusCount ?? 0),
        health: p.health ?? 100,
        keys: p.keys ?? 0,
        castingDayMiniGameScore: (game.gameType === "CASTING" || game.gameType === "CASTING_BOT" || game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT")
          ? (p.castingDayMiniGameScore ?? 0)
          : undefined,
        tribe: (p as { tribe?: string | null }).tribe ?? null,
        food: p.food ?? 70,
        water: p.water ?? 70,
        hasImmunity: (p as { hasImmunity?: boolean }).hasImmunity ?? false,
        challengeScore: (p as { challengeScore?: number }).challengeScore ?? 0,
        sittingOut: (p as { sittingOut?: boolean }).sittingOut ?? false,

        isNominee: isCastingNominee || isFastingNominee,

        avatar: {
          bodyStyle: u.bodyStyle,
          hairStyle: u.hairStyle,
          eyesStyle: u.eyesStyle,
          mouthStyle: u.mouthStyle,
          shirtStyle: u.shirtStyle,
          accessoryStyle: u.accessoryStyle,
          glassesStyle: "none",
          scarStyle: "none",
          hairOrnamentStyle: "none",
          bodyColor: u.bodyColor,
          hairColor: u.hairColor,
          eyeColor: u.eyeColor,
          mouthColor: u.mouthColor,
          shirtColor: u.shirtColor,
          accessoryColor: u.accessoryColor,
          backgroundColor: "#E8E8E8",
          glassesColor: "#111111",
          scarColor: "#8B4513",
          hairOrnamentColor: "#C0C0C0",
        },
        slotDesigns: slotDesigns && Object.keys(slotDesigns).length ? slotDesigns : undefined,
      };
    });
    })(),

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
