import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gp = await prisma.gamePlayer.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      game: { state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    },
    select: { gameId: true },
  });

  return NextResponse.json({ ok: true, gameId: gp?.gameId ?? null });
}
