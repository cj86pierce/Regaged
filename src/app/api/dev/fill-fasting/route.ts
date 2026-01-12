import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

const FASTING_NOM_MS = 2 * 60 * 1000; // 2 minutes

function rnd(n = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.game.findFirst({
    where: { gameType: "FASTING", state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, gameId: existing.id, note: "Game already running" });

  const bots: { id: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const username = `bot_${rnd(4)}_${i}`;
    const passwordHash = await bcrypt.hash("password123", 8);
    const u = await prisma.user.create({
      data: { username, passwordHash, karma: 0, tMoney: 0 },
      select: { id: true },
    });
    bots.push(u);
  }

  const game = await prisma.game.create({
    data: {
      gameType: "FASTING",
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: new Date(),
      stateEndsAt: new Date(Date.now() + FASTING_NOM_MS),
    },
    select: { id: true },
  });

  await prisma.gamePlayer.create({ data: { gameId: game.id, userId } });
  await prisma.gamePlayer.createMany({ data: bots.map((b) => ({ gameId: game.id, userId: b.id })) });

  return NextResponse.json({ ok: true, gameId: game.id });
}
