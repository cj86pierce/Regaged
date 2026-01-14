import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";

const FAST_FORWARD_SECONDS = 15;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { state: true, roundNumber: true, stateEndsAt: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.state !== "ROUND_VOTE") return NextResponse.json({ error: "Not in voting phase" }, { status: 400 });
  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) return NextResponse.json({ error: "Voting phase ended" }, { status: 400 });

  const gp = await prisma.gamePlayer.findUnique({ where: { gameId_userId: { gameId, userId } } });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true },
  });
  if (!rr) return NextResponse.json({ error: "Nominees not set yet" }, { status: 400 });

  if (userId === rr.nomineeAUserId || userId === rr.nomineeBUserId)
    return NextResponse.json({ error: "Nominees cannot vote" }, { status: 403 });

  const body = await req.json().catch(() => null);
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

  // ✅ FAST-FORWARD: if all eligible voters have voted, set timer to 15s (if >15s left)
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
