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
    select: { state: true, roundNumber: true, stateEndsAt: true, gameType: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.state !== "ROUND_VOTE") return NextResponse.json({ error: "Not in voting phase" }, { status: 400 });
  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) return NextResponse.json({ error: "Voting phase ended" }, { status: 400 });

  const gp = await prisma.gamePlayer.findUnique({ where: { gameId_userId: { gameId, userId } } });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true, nomineeCUserId: true },
  });
  if (!rr) return NextResponse.json({ error: "Nominees not set yet" }, { status: 400 });

  const nominees = [rr.nomineeAUserId, rr.nomineeBUserId, rr.nomineeCUserId].filter(Boolean) as string[];
  const isRookies = game.gameType === "ROOKIES" && nominees.length >= 3;

  if (nominees.includes(userId))
    return NextResponse.json({ error: "Nominees cannot vote" }, { status: 403 });

  const body = await req.json().catch(() => null);

  if (isRookies) {
    const rankings = body?.rankings && typeof body.rankings === "object" ? body.rankings as Record<string, number> : null;
    if (!rankings) return NextResponse.json({ error: "rankings required: { nomineeUserId: 1|2|3 } for each nominee (1=save, 2=evict if #1 saved, 3=evict)" }, { status: 400 });
    const given = new Set<number>();
    for (const uid of nominees) {
      const p = Number(rankings[uid]);
      if (!Number.isInteger(p) || p < 1 || p > 3) return NextResponse.json({ error: "Each nominee must receive exactly one of 1, 2, 3" }, { status: 400 });
      given.add(p);
    }
    if (given.size !== 3) return NextResponse.json({ error: "Each nominee must receive exactly one of 1, 2, 3" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      for (const targetUserId of nominees) {
        const points = Number(rankings[targetUserId]);
        await tx.rankingVote.upsert({
          where: {
            gameId_roundNumber_voterUserId_targetUserId: { gameId, roundNumber: game.roundNumber, voterUserId: userId, targetUserId },
          },
          update: { points },
          create: { gameId, roundNumber: game.roundNumber, voterUserId: userId, targetUserId, points },
        });
      }
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId } },
        data: { lastActiveAt: new Date() },
      });
    });

    await touchUser(userId);

    const activePlayers = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      select: { userId: true },
    });
    const eligibleVoters = activePlayers.map((p) => p.userId).filter((uid) => !nominees.includes(uid));
    const rankingVotes = await prisma.rankingVote.findMany({
      where: { gameId, roundNumber: game.roundNumber },
      select: { voterUserId: true },
    });
    const countByVoter = new Map<string, number>();
    for (const v of rankingVotes) countByVoter.set(v.voterUserId, (countByVoter.get(v.voterUserId) ?? 0) + 1);
    const allDone = eligibleVoters.length > 0 && eligibleVoters.every((uid) => (countByVoter.get(uid) ?? 0) >= 3);
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

  const targetUserId = (body?.targetUserId ?? "").toString();
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  if (targetUserId !== rr.nomineeAUserId && targetUserId !== rr.nomineeBUserId)
    return NextResponse.json({ error: "You must vote to evict a nominee." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.evictionVote.upsert({
      where: { gameId_roundNumber_voterUserId: { gameId, roundNumber: game.roundNumber, voterUserId: userId } },
      update: { targetUserId },
      create: { gameId, roundNumber: game.roundNumber, voterUserId: userId, targetUserId },
    });

    await tx.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { lastActiveAt: new Date() },
    });
  });

  await touchUser(userId);

  const activePlayers = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
  });

  const eligibleVoters = activePlayers
    .map((p) => p.userId)
    .filter((uid) => uid !== rr.nomineeAUserId && uid !== rr.nomineeBUserId);

  const votes = await prisma.evictionVote.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { voterUserId: true },
  });
  const voted = new Set(votes.map((v) => v.voterUserId));
  const allDone = eligibleVoters.every((uid) => voted.has(uid));

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
