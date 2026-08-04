import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  const gameId = params.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game || (game.gameType !== "ROOKIES" && game.gameType !== "ROOKIES_BOT")) {
    return NextResponse.json({ error: "Not a Rookies game" }, { status: 404 });
  }

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, user: { select: { username: true } } },
  });

  const myBet = userId
    ? await prisma.rookiesBet.findUnique({
        where: { gameId_betterUserId: { gameId, betterUserId: userId } },
        select: {
          amount: true,
          targetUserId: true,
          paidOutAt: true,
          payoutAmount: true,
        },
      })
    : null;

  const isPlayer = userId
    ? !!(await prisma.gamePlayer.findUnique({
        where: { gameId_userId: { gameId, userId } },
        select: { id: true },
      }))
    : false;

  const day1 = game.state !== "COMPLETED" && game.roundNumber <= 1;
  const bettingOpen =
    game.gameType === "ROOKIES" &&
    day1 &&
    game.state !== "COMPLETED" &&
    !isPlayer;

  return NextResponse.json({
    bettingOpen,
    isPlayer,
    myBet,
    contestants: players.map((p) => ({ userId: p.userId, username: p.user.username })),
    payoutTable: [
      { place: "1st", note: "stake + 100%" },
      { place: "2nd", note: "stake + 30%" },
      { place: "3rd", note: "stake + 20%" },
      { place: "4th", note: "stake + 10%" },
      { place: "5th", note: "stake back" },
      { place: "6th+", note: "lose stake" },
    ],
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;
  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const amount = Math.trunc(Number(body?.amount));

  if (!targetUserId) return NextResponse.json({ error: "Pick a contestant" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 1 || amount > 30) {
    return NextResponse.json({ error: "Bet must be 1–30 T$" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game || game.gameType !== "ROOKIES") {
    return NextResponse.json({ error: "Betting only on live Rookies" }, { status: 400 });
  }
  if (game.state === "COMPLETED" || game.roundNumber > 1) {
    return NextResponse.json({ error: "Betting is only open on Day 1" }, { status: 400 });
  }

  const isPlayer = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { id: true },
  });
  if (isPlayer) {
    return NextResponse.json({ error: "Players cannot bet on their own game" }, { status: 403 });
  }

  const target = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: targetUserId } },
    select: { status: true },
  });
  if (!target || target.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid contestant" }, { status: 400 });
  }

  const existing = await prisma.rookiesBet.findUnique({
    where: { gameId_betterUserId: { gameId, betterUserId: userId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You already placed a bet this game" }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, tMoney: { gte: amount } },
        data: { tMoney: { decrement: amount } },
      });
      if (updated.count === 0) throw new Error("NOT_ENOUGH_T");
      await tx.rookiesBet.create({
        data: {
          gameId,
          betterUserId: userId,
          targetUserId,
          amount,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_ENOUGH_T") {
      return NextResponse.json({ error: "Not enough T$" }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
