import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const FASTING_MAX_PLAYERS = 15;
const FASTING_MIN_HUMANS_TO_START = 2;
const FASTING_NOM_MS = 2 * 60 * 1000; // 2 minutes (your new timing)

function rnd(n = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function createSilentBots(count: number) {
  const bots: { id: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const username = `bot_${rnd(4)}_${Date.now()}_${i}`;
    const passwordHash = await bcrypt.hash("password123", 8);

    const u = await prisma.user.create({
      data: { username, passwordHash, karma: 0, tMoney: 0 },
      select: { id: true },
    });

    bots.push(u);
  }
  return bots;
}

/**
 * Starts a FASTING game as soon as we have 2 human enrollments.
 * The remaining seats are filled with silent bots (no behavior).
 */
export async function tryStartFastingGame() {
  const enrollments = await prisma.enrollment.findMany({
    where: { gameType: "FASTING" },
    orderBy: { createdAt: "asc" },
    take: FASTING_MAX_PLAYERS, // never need more than 15
  });

  if (enrollments.length < FASTING_MIN_HUMANS_TO_START) return;

  // Take the first 2 humans to start
  const humanEnrollments = enrollments.slice(0, FASTING_MIN_HUMANS_TO_START);

  // Create bots to reach 15 total players
  const botsNeeded = FASTING_MAX_PLAYERS - humanEnrollments.length;
  const bots = botsNeeded > 0 ? await createSilentBots(botsNeeded) : [];

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

  // Add humans
  await prisma.gamePlayer.createMany({
    data: humanEnrollments.map((e) => ({ gameId: game.id, userId: e.userId })),
  });

  // Add bots
  if (bots.length) {
    await prisma.gamePlayer.createMany({
      data: bots.map((b) => ({ gameId: game.id, userId: b.id })),
    });
  }

  // Remove just the humans we used from enrollment
  await prisma.enrollment.deleteMany({
    where: { id: { in: humanEnrollments.map((e) => e.id) } },
  });
}
