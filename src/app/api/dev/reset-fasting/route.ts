import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Find any active fasting games
  const games = await prisma.game.findMany({
    where: { gameType: "FASTING", state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    select: { id: true },
  });

  // Delete games (cascades will remove related rows because we set onDelete: Cascade)
  if (games.length) {
    await prisma.game.deleteMany({
      where: { id: { in: games.map(g => g.id) } },
    });
  }

  // Remove dev bots we created (username starts with bot_)
  await prisma.user.deleteMany({
    where: { username: { startsWith: "bot_" } },
  });

  // Also clean enrollments for fasting (optional cleanup)
  await prisma.enrollment.deleteMany({
    where: { gameType: "FASTING" },
  });

  return NextResponse.json({ ok: true, deletedGames: games.length });
}
