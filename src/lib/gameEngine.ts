import { prisma } from "@/lib/prisma";
import { assignFastingPov } from "@/lib/fastingPov";

const FASTING_MAX = 15;
const FASTING_NOM_MS = 2 * 60 * 1000;

export async function tryStartFastingGame(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true, state: true, roundNumber: true },
  });
  if (!game) return { ok: false, error: "Game not found" as const };
  if (game.gameType !== "FASTING") return { ok: false, error: "Not fasting" as const };
  if (game.state !== "ENROLLING") return { ok: true, skipped: true as const };

  const count = await prisma.gamePlayer.count({
    where: { gameId, status: "ACTIVE" },
  });

  if (count < FASTING_MAX) return { ok: true, skipped: true as const };

  const now = new Date();

  // Start the game
  await prisma.game.update({
    where: { id: gameId },
    data: {
      state: "ROUND_NOMINATE",
      roundNumber: 1,
      startsAt: now,
      roundStartedAt: now, // ✅ NEW
      stateEndsAt: new Date(now.getTime() + FASTING_NOM_MS),
      povUserId: null,
    },
  });

  // Assign POV immediately (now 1-arg)
  try {
    await assignFastingPov(gameId);
  } catch {
    // cron/state route will retry later
  }

  return { ok: true };
}
