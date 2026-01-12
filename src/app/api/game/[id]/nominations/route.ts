import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gameId = params.id;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, state: true, roundNumber: true, povUserId: true, stateEndsAt: true },
  });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.state !== "ROUND_NOMINATE") return NextResponse.json({ error: "Not in nomination phase" }, { status: 400 });

  if (game.stateEndsAt && Date.now() > game.stateEndsAt.getTime()) {
    return NextResponse.json({ error: "Nomination phase ended" }, { status: 400 });
  }

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
  });
  if (!gp || gp.status !== "ACTIVE") return NextResponse.json({ error: "Not in game" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const picks = Array.isArray(body?.targets) ? body.targets : [];

  const targets = picks.map(String);
  const uniq = Array.from(new Set(targets)).filter(Boolean);

  if (uniq.length !== 2) return NextResponse.json({ error: "Pick exactly 2 unique nominees." }, { status: 400 });

  // Cannot nominate POV
  if (game.povUserId && uniq.includes(game.povUserId)) {
    return NextResponse.json({ error: "You cannot nominate the POV." }, { status: 400 });
  }

  // Validate targets are ACTIVE players in this game
  const validTargets = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", userId: { in: uniq } },
    select: { userId: true },
  });
  if (validTargets.length !== 2) return NextResponse.json({ error: "Invalid nominee selection." }, { status: 400 });

  // Replace your nominations for this round (so you can change your mind until time ends)
  await prisma.$transaction(async (tx) => {
    await tx.nomination.deleteMany({
      where: { gameId, roundNumber: game.roundNumber, voterUserId: userId },
    });

    await tx.nomination.createMany({
      data: uniq.map((t) => ({
        gameId,
        roundNumber: game.roundNumber,
        voterUserId: userId,
        targetUserId: t,
      })),
    });
  });

  return NextResponse.json({ ok: true });
}