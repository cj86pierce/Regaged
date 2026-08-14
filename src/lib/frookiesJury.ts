/**
 * Frookies (Fast Mode Rookies) jury endgame.
 *
 * Simplified vs. the original game's special final-4 HOH+POV double
 * competition: instead of a dedicated final-4 mini-game, normal HOH/POV/
 * eviction rounds simply continue until 2 players remain. At that point the
 * jury - everyone eliminated in 9th through 3rd place - votes for one of the
 * final 2 to win. This keeps the core "jury decides the winner" mechanic
 * without a large amount of extra one-off final-4 game logic.
 */
import { prisma } from "@/lib/prisma";
import { ROOKIES_FAST_PRIZES, prizeForPlace } from "@/lib/gamePrizes";
import { getSystemUserId } from "@/lib/systemUser";

const JURY_VOTE_MS = 24 * 60 * 60 * 1000;
const JURY_VOTE_BOT_MS = 2 * 60 * 1000;

export const JURY_MIN_PLACE = 3;
export const JURY_MAX_PLACE = 9;

export async function enterFrookiesJuryPhase(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, gameType: true },
  });
  if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) return;

  const finalists = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
  });
  if (finalists.length !== 2) return;

  const now = new Date();
  const isBot = game.gameType === "FROOKIES_BOT";
  const voteMs = isBot ? JURY_VOTE_BOT_MS : JURY_VOTE_MS;
  const systemUserId = await getSystemUserId();

  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "JURY_VOTE",
        stateEndsAt: new Date(now.getTime() + voteMs),
        povUserId: null,
        hohUserId: null,
        povSavedUserId: null,
        frookiesPhase: null,
      },
    });

    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body:
          `[SYSTEM] Final 2: ${finalists[0]!.user.username} vs ${finalists[1]!.user.username}. ` +
          `The jury (evicted players who placed 9th through 3rd) will now vote for the winner.`,
      },
    });
  });
}

export async function resolveFrookiesJuryVoteIfDue(gameId: string) {
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${gameId + "_jury"})) as locked
  `;
  if (!lockRows?.[0]?.locked) return { ok: true, skipped: true as const, reason: "locked" as const };

  try {
    const now = new Date();
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, stateEndsAt: true },
    });
    if (!game || (game.gameType !== "FROOKIES" && game.gameType !== "FROOKIES_BOT")) {
      return { ok: true, skipped: true as const, reason: "not_frookies" as const };
    }
    if (game.state !== "JURY_VOTE") return { ok: true, skipped: true as const, reason: "wrong_state" as const };
    if (!game.stateEndsAt || game.stateEndsAt.getTime() > now.getTime()) {
      return { ok: true, skipped: true as const, reason: "not_due" as const };
    }

    const finalists = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE" },
      include: { user: { select: { username: true } } },
    });
    if (finalists.length !== 2) return { ok: false, error: "expected_two_finalists" as const };

    const votes = await prisma.juryVote.findMany({
      where: { gameId },
      select: { targetUserId: true },
    });

    const tallyA = votes.filter((v) => v.targetUserId === finalists[0]!.userId).length;
    const tallyB = votes.filter((v) => v.targetUserId === finalists[1]!.userId).length;

    const winner =
      tallyA === tallyB
        ? finalists[Math.floor(Math.random() * 2)]!
        : tallyA > tallyB
          ? finalists[0]!
          : finalists[1]!;
    const runnerUp = winner.userId === finalists[0]!.userId ? finalists[1]! : finalists[0]!;

    const systemUserId = await getSystemUserId();
    const isBotGame = game.gameType === "FROOKIES_BOT";

    await prisma.$transaction(async (tx) => {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: winner.userId } },
        data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: 1 },
      });
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: runnerUp.userId } },
        data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: 2 },
      });

      await tx.game.update({
        where: { id: gameId },
        data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
      });

      await tx.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body:
            `[SYSTEM] The jury has spoken! ${winner.user.username} wins (${Math.max(tallyA, tallyB)}-${Math.min(tallyA, tallyB)}) ` +
            `over ${runnerUp.user.username}.`,
        },
      });
    });

    if (!isBotGame) {
      const { applyPlacementPayout, isGameBotFilled } = await import("@/lib/botFillPayout");
      const botFilled = await isGameBotFilled(gameId);
      // 1st/2nd per the Frookies (ROOKIES FAST) table; 3rd–5th paid below (6th is 0/0).
      const first = prizeForPlace(ROOKIES_FAST_PRIZES, 1)!;
      const second = prizeForPlace(ROOKIES_FAST_PRIZES, 2)!;
      await applyPlacementPayout(winner.userId, first.karma, first.tMoney, { botFilled });
      await applyPlacementPayout(runnerUp.userId, second.karma, second.tMoney, { botFilled });
      await payFrookiesPlacementsThreeThroughFive(gameId, botFilled);
    }

    return { ok: true, finished: true as const, winnerUserId: winner.userId };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${gameId + "_jury"}))`;
  }
}

async function payFrookiesPlacementsThreeThroughFive(gameId: string, botFilled: boolean) {
  const { applyPlacementPayout } = await import("@/lib/botFillPayout");
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, eliminatedPlace: { in: [3, 4, 5] } },
    select: { userId: true, eliminatedPlace: true },
  });
  for (const p of players) {
    const pay = prizeForPlace(ROOKIES_FAST_PRIZES, p.eliminatedPlace!);
    if (!pay) continue;
    await applyPlacementPayout(p.userId, pay.karma, pay.tMoney, { botFilled });
  }
}
