import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";

const FAST_FORWARD_SECONDS = 3;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, povUserId: true, hohUserId: true, povSavedUserId: true, stateEndsAt: true, frookiesPhase: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.state !== "ROUND_NOMINATE") return NextResponse.json({ error: "Not in nomination phase" }, { status: 400 });
  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) return NextResponse.json({ error: "Nomination phase ended" }, { status: 400 });

  const gp = await prisma.gamePlayer.findUnique({ where: { gameId_userId: { gameId, userId } } });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const isFrookies = game.gameType === "FROOKIES" || game.gameType === "FROOKIES_BOT";
  // ROOKIES_BOT is intentionally excluded: its bot-driving logic
  // (fastingBotAdvance.ts) doesn't assign a real HOH the way human ROOKIES
  // does, so gating on hohUserId would reject every bot nomination.
  const isRookies = game.gameType === "ROOKIES";
  if ((isFrookies || isRookies) && game.hohUserId !== userId) {
    return NextResponse.json({ error: "Only the HOH can nominate." }, { status: 403 });
  }

  const body: any = await req.json().catch(() => null);
  const rawTargets: unknown = body?.targets;
  if (!Array.isArray(rawTargets)) return NextResponse.json({ error: "targets must be an array" }, { status: 400 });

  const uniq: string[] = Array.from(new Set(rawTargets.map((x) => String(x).trim()))).filter((s) => s.length > 0);

  if (isFrookies && game.frookiesPhase === "POV_SAVE") {
    return NextResponse.json({ error: "Waiting for POV to use save. No nomination changes now." }, { status: 400 });
  }

  const isHohRenom = isFrookies && game.frookiesPhase === "HOH_RENOM";
  if (isHohRenom) {
    if (uniq.length !== 1) return NextResponse.json({ error: "Pick exactly 1 replacement nominee." }, { status: 400 });
    const replacement = uniq[0]!;
    const rr = await prisma.roundResult.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
      select: { nomineeAUserId: true },
    });
    if (!rr?.nomineeAUserId) return NextResponse.json({ error: "Round state invalid." }, { status: 400 });
    const valid = await prisma.gamePlayer.findUnique({
      where: { gameId_userId: { gameId, userId: replacement } },
      select: { status: true },
    });
    if (!valid || valid.status !== "ACTIVE") return NextResponse.json({ error: "Invalid replacement nominee." }, { status: 400 });
    if (replacement === rr.nomineeAUserId) return NextResponse.json({ error: "Replacement must be different from the other nominee." }, { status: 400 });

    const { getFastingVoteMs } = await import("@/lib/fastingTiming");
    const voteMs = getFastingVoteMs();
    await prisma.$transaction([
      prisma.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { nomineeBUserId: replacement },
      }),
      prisma.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_VOTE",
          stateEndsAt: new Date(Date.now() + voteMs),
          frookiesPhase: null,
        },
      }),
    ]);
    await touchUser(userId);
    return NextResponse.json({ ok: true, replacement: true });
  }

  if (uniq.length !== 2) return NextResponse.json({ error: "Pick exactly 2 unique nominees." }, { status: 400 });

  if (game.povUserId && uniq.includes(game.povUserId)) return NextResponse.json({ error: "You cannot nominate the POV holder." }, { status: 400 });
  if (game.povSavedUserId && uniq.includes(game.povSavedUserId)) return NextResponse.json({ error: "You cannot nominate the POV-saved player." }, { status: 400 });

  const validTargets = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", userId: { in: uniq } },
    select: { userId: true },
  });
  if (validTargets.length !== 2) return NextResponse.json({ error: "Invalid nominee selection." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.nomination.deleteMany({ where: { gameId, roundNumber: game.roundNumber, voterUserId: userId } });
    await tx.nomination.createMany({
      data: uniq.map((t) => ({ gameId, roundNumber: game.roundNumber, voterUserId: userId, targetUserId: t })),
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { lastActiveAt: new Date() },
    });
  });

  await touchUser(userId);

  // ✅ FAST-FORWARD: if everyone eligible has submitted, set timer to 15s (if >15s left)
  const activePlayers = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
  });

  const eligibleVoters = activePlayers
    .map((p) => p.userId)
    .filter((uid) => uid !== game.povUserId); // POV can’t nominate? (they still nominate in your rules, just can’t be nominated. If POV can nominate, remove this filter.)

  // if POV *is allowed to nominate* in your rules, comment the filter above out.

  const nomCounts = await prisma.nomination.groupBy({
    by: ["voterUserId"],
    where: { gameId, roundNumber: game.roundNumber },
    _count: { _all: true },
  });

  const votersWith2 = new Set(nomCounts.filter((r) => r._count._all >= 2).map((r) => r.voterUserId));
  const allDone = eligibleVoters.every((uid) => votersWith2.has(uid));

  if (allDone && game.stateEndsAt) {
    const leftMs = game.stateEndsAt.getTime() - Date.now();
    if (leftMs > FAST_FORWARD_SECONDS * 1000) {
      await prisma.game.update({
        where: { id: gameId },
        data: { stateEndsAt: new Date(Date.now() + FAST_FORWARD_SECONDS * 1000) },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
