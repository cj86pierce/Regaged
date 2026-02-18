import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const voterUserId = await getCurrentUserId(req);
  if (!voterUserId) return bad("Unauthorized", 401);

  const gameId = params.id;

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true },
  });
  if (!g || g.gameType !== "CASTING") return bad("Not a casting game", 400);
  if (g.state !== "ROUND_VOTE") return bad("Not in voting phase", 400);

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: voterUserId } },
    select: { status: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  const dayNumber = g.roundNumber;

  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber } },
    select: { nomineeUserIds: true },
  });
  if (!day || !day.nomineeUserIds?.length) return bad("No nominees", 400);

  const nominees = day.nomineeUserIds;

  const body = await req.json().catch(() => null);
  const pointsMap = body?.pointsMap as Record<string, number>;
  if (!pointsMap || typeof pointsMap !== "object") return bad("pointsMap required");

  const entries = Object.entries(pointsMap).filter(([id]) => nominees.includes(id));
  if (entries.length !== nominees.length) return bad("Must assign points to all nominees");

  const expected = nominees.length === 4 ? [0, 1, 2, 3] : [1, 2, 3];
  const got = entries.map(([, v]) => Number(v)).sort((a, b) => a - b);
  if (got.join(",") !== expected.join(",")) return bad(`Points must be ${expected.join(",")}`);

  await prisma.$transaction(async (tx) => {
    // overwrite saved votes
    await tx.castingVote.deleteMany({ where: { gameId, dayNumber, voterUserId } });
    for (const [targetUserId, points] of entries) {
      await tx.castingVote.create({
        data: { gameId, dayNumber, voterUserId, targetUserId, points: Number(points) },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
