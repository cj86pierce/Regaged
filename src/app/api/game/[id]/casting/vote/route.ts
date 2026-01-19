import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return bad("Unauthorized", 401);

  const gameId = params.id;

  const body = await req.json().catch(() => null);
  const pointsMap = body?.pointsMap as Record<string, number>; // { nomineeUserId: 1|2|3 }

  if (!pointsMap || typeof pointsMap !== "object") return bad("pointsMap required");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!game || game.gameType !== "CASTING") return bad("Not a casting game", 400);
  if (game.state !== "ROUND_VOTE") return bad("Not in voting phase", 400);

  // must be active in game
  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  const dayNumber = game.roundNumber;

  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true, nomineeCUserId: true, evictedUserId: true },
  });
  if (!day || day.evictedUserId) return bad("No nominees", 400);

  const nominees = [day.nomineeAUserId, day.nomineeBUserId, day.nomineeCUserId];

  // validate: must assign 1/2/3 exactly once
  const entries = Object.entries(pointsMap).filter(([k, v]) => nominees.includes(k));
  if (entries.length !== 3) return bad("Must assign points to all 3 nominees");

  const pts = entries.map(([, v]) => v).sort();
  if (pts.join(",") !== "1,2,3") return bad("Points must be 1,2,3");

  // store votes (one row per voter, overwrite by delete+create)
  await prisma.$transaction(async (tx) => {
    await tx.castingVote.deleteMany({ where: { gameId, dayNumber, voterUserId: userId } });

    for (const [targetUserId, points] of entries) {
      await tx.castingVote.create({
        data: { gameId, dayNumber, voterUserId: userId, targetUserId, points },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
