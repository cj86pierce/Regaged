/**
 * Bot actions: nominate, vote, send dummy chat.
 * Callable from cron to make bots act in FASTING_BOT / CASTING_BOT games.
 */
import { prisma } from "@/lib/prisma";

const DUMMY_CHAT_MESSAGES = [
  "🤖 *beep*",
  "Thinking...",
  "Interesting.",
  "Hmm.",
  "Okay.",
  "Sure thing!",
  "Let me consider.",
  "🤔",
];

/** Pick a random subset of items */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

/** Send a random dummy chat message as a bot user */
export async function botSendChat(gameId: string, userId: string): Promise<boolean> {
  const msg = DUMMY_CHAT_MESSAGES[Math.floor(Math.random() * DUMMY_CHAT_MESSAGES.length)];
  try {
    await prisma.gameMessage.create({
      data: { gameId, userId, channel: "PUBLIC", body: msg },
    });
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId } },
      data: { chatCount: { increment: 1 }, lastActiveAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/** Bot nominates a random target (FASTING_BOT) */
export async function botNominate(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, roundNumber: true, povUserId: true, state: true },
  });
  if (!game || (game.gameType !== "FASTING_BOT" && game.gameType !== "FROOKIES_BOT" && game.gameType !== "ROOKIES_BOT") || game.state !== "ROUND_NOMINATE") return false;

  const povId = game.povUserId ?? "";
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", ...(povId ? { userId: { not: povId } } : {}) },
    select: { userId: true },
  });
  const targets = players.filter((p) => p.userId !== voterUserId);
  if (targets.length === 0) return false;

  const target = targets[Math.floor(Math.random() * targets.length)]!;
  try {
    await prisma.nomination.create({
      data: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId,
        targetUserId: target.userId,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Bot votes for a nominee (FASTING_BOT - eviction vote) */
export async function botVoteFasting(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, roundNumber: true, state: true },
  });
  if (!game || (game.gameType !== "FASTING_BOT" && game.gameType !== "FROOKIES_BOT" && game.gameType !== "ROOKIES_BOT") || game.state !== "ROUND_VOTE") return false;

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true },
  });
  if (!rr?.nomineeAUserId || !rr?.nomineeBUserId) return false;

  const target = Math.random() < 0.5 ? rr.nomineeAUserId : rr.nomineeBUserId;
  try {
    await prisma.evictionVote.upsert({
      where: {
        gameId_roundNumber_voterUserId: { gameId, roundNumber: game.roundNumber, voterUserId },
      },
      update: { targetUserId: target },
      create: { gameId, roundNumber: game.roundNumber, voterUserId, targetUserId: target },
    });
    return true;
  } catch {
    return false;
  }
}

/** Bot votes for a nominee (CASTING_BOT - casting vote) */
export async function botVoteCasting(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, roundNumber: true, state: true },
  });
  if (!game || game.gameType !== "CASTING_BOT" || game.state !== "ROUND_VOTE") return false;

  const day = await prisma.castingDayResult.findUnique({
    where: { gameId_dayNumber: { gameId, dayNumber: game.roundNumber } },
    select: { nomineeUserIds: true },
  });
  if (!day?.nomineeUserIds?.length) return false;

  const target = day.nomineeUserIds[Math.floor(Math.random() * day.nomineeUserIds.length)]!;
  const points = Math.floor(Math.random() * 3) + 1; // 1-3 points
  try {
    await prisma.castingVote.upsert({
      where: {
        gameId_dayNumber_voterUserId_targetUserId: {
          gameId,
          dayNumber: game.roundNumber,
          voterUserId,
          targetUserId: target,
        },
      },
      update: { points },
      create: { gameId, dayNumber: game.roundNumber, voterUserId, targetUserId: target, points },
    });
    return true;
  } catch {
    return false;
  }
}

/** Perform random bot actions for a single bot in a game */
export async function performBotActions(gameId: string): Promise<{ chat: number; nom: number; vote: number }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, povUserId: true },
  });
  if (!game) return { chat: 0, nom: 0, vote: 0 };
  const gameType = game.gameType;

  if (gameType !== "FASTING_BOT" && gameType !== "CASTING_BOT" && gameType !== "FROOKIES_BOT" && gameType !== "ROOKIES_BOT") return { chat: 0, nom: 0, vote: 0 };

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, user: { select: { usernameLower: true } } },
  });

  const botPlayers = players.filter((p) => p.user.usernameLower.startsWith("bot_"));
  if (botPlayers.length === 0) return { chat: 0, nom: 0, vote: 0 };

  const toAct = pickRandom(botPlayers, Math.min(3, botPlayers.length));
  let chat = 0,
    nom = 0,
    vote = 0;

  for (const p of toAct) {
    const r = Math.random();
    if (r < 0.4) {
      if (await botSendChat(gameId, p.userId)) chat++;
    } else if (gameType === "FASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") {
      if (game.state === "ROUND_NOMINATE" && r < 0.7) {
        if (await botNominate(gameId, p.userId)) nom++;
      } else if (game.state === "ROUND_VOTE" && r < 0.7) {
        if (await botVoteFasting(gameId, p.userId)) vote++;
      }
    } else if (gameType === "CASTING_BOT") {
      if (game.state === "ROUND_VOTE" && r < 0.7) {
        if (await botVoteCasting(gameId, p.userId)) vote++;
      }
    }
  }

  return { chat, nom, vote };
}
