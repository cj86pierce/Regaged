/**
 * Bot actions for practice modes: nominate, vote, chat, POV save, jury.
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

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

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

/** Nominate: Fasting anyone; Frookies/Rookies only HOH picks 2. */
export async function botNominate(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      roundNumber: true,
      povUserId: true,
      hohUserId: true,
      povSavedUserId: true,
      state: true,
      frookiesPhase: true,
    },
  });
  if (
    !game ||
    (game.gameType !== "FASTING_BOT" &&
      game.gameType !== "FROOKIES_BOT" &&
      game.gameType !== "ROOKIES_BOT") ||
    game.state !== "ROUND_NOMINATE"
  ) {
    return false;
  }

  const isHohMode = game.gameType === "FROOKIES_BOT" || game.gameType === "ROOKIES_BOT";
  if (isHohMode && game.hohUserId !== voterUserId) return false;
  if (game.gameType === "FROOKIES_BOT" && (game.frookiesPhase === "POV_SAVE" || game.frookiesPhase === "HOH_RENOM")) {
    return false;
  }

  const exclude = new Set<string>(
    [game.povUserId, game.povSavedUserId, isHohMode ? game.hohUserId : null].filter(Boolean) as string[]
  );
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", ...(exclude.size ? { userId: { notIn: [...exclude] } } : {}) },
    select: { userId: true },
  });
  const targets = players.filter((p) => p.userId !== voterUserId);
  if (targets.length === 0) return false;

  if (isHohMode) {
    const two = pickRandom(targets, 2);
    if (two.length < 2) return false;
    try {
      await prisma.nomination.deleteMany({
        where: { gameId, roundNumber: game.roundNumber, voterUserId },
      });
      await prisma.nomination.createMany({
        data: two.map((t) => ({
          gameId,
          roundNumber: game.roundNumber,
          voterUserId,
          targetUserId: t.userId,
        })),
      });
      return true;
    } catch {
      return false;
    }
  }

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

/** Frookies: POV bot saves someone during POV_SAVE. */
export async function botFrookiesPovSave(gameId: string, povUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true, roundNumber: true, povUserId: true, frookiesPhase: true, povSavedUserId: true },
  });
  if (
    !game ||
    game.gameType !== "FROOKIES_BOT" ||
    game.state !== "ROUND_NOMINATE" ||
    game.frookiesPhase !== "POV_SAVE" ||
    game.povUserId !== povUserId ||
    game.povSavedUserId
  ) {
    return false;
  }

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true, nomineeBUserId: true },
  });
  const candidates = [povUserId, rr?.nomineeAUserId, rr?.nomineeBUserId].filter(Boolean) as string[];
  const uniq = [...new Set(candidates)];
  const save = uniq[Math.floor(Math.random() * uniq.length)]!;
  try {
    await prisma.game.update({
      where: { id: gameId },
      data: { povSavedUserId: save },
    });
    return true;
  } catch {
    return false;
  }
}

/** Frookies: HOH bot picks replacement during HOH_RENOM. */
export async function botFrookiesHohRenom(gameId: string, hohUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      state: true,
      roundNumber: true,
      hohUserId: true,
      povUserId: true,
      frookiesPhase: true,
    },
  });
  if (
    !game ||
    game.gameType !== "FROOKIES_BOT" ||
    game.state !== "ROUND_NOMINATE" ||
    game.frookiesPhase !== "HOH_RENOM" ||
    game.hohUserId !== hohUserId
  ) {
    return false;
  }

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: { nomineeAUserId: true },
  });
  if (!rr?.nomineeAUserId) return false;

  const immune = new Set([game.hohUserId, game.povUserId, rr.nomineeAUserId].filter(Boolean) as string[]);
  const pool = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", userId: { notIn: [...immune] } },
    select: { userId: true },
  });
  if (pool.length === 0) return false;
  const replacement = pool[Math.floor(Math.random() * pool.length)]!.userId;

  const { BOT_ROUND_MS } = await import("@/lib/fastingTiming");
  try {
    await prisma.$transaction([
      prisma.roundResult.update({
        where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
        data: { nomineeBUserId: replacement },
      }),
      prisma.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_VOTE",
          stateEndsAt: new Date(Date.now() + BOT_ROUND_MS),
          frookiesPhase: null,
        },
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Binary eviction vote (Fasting / Frookies / Rookies with only 2 nominees). */
export async function botVoteFasting(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, roundNumber: true, state: true },
  });
  if (
    !game ||
    (game.gameType !== "FASTING_BOT" &&
      game.gameType !== "FROOKIES_BOT" &&
      game.gameType !== "ROOKIES_BOT") ||
    game.state !== "ROUND_VOTE"
  ) {
    return false;
  }

  const rr = await prisma.roundResult.findUnique({
    where: { gameId_roundNumber: { gameId, roundNumber: game.roundNumber } },
    select: {
      nomineeAUserId: true,
      nomineeBUserId: true,
      nomineeCUserId: true,
      nomineeDUserId: true,
    },
  });
  if (!rr?.nomineeAUserId || !rr?.nomineeBUserId) return false;

  const nominees = [
    rr.nomineeAUserId,
    rr.nomineeBUserId,
    rr.nomineeCUserId,
    rr.nomineeDUserId,
  ].filter(Boolean) as string[];
  if (nominees.includes(voterUserId)) return false;

  // Rookies ranking when 3+ nominees
  if (game.gameType === "ROOKIES_BOT" && nominees.length >= 3) {
    const allowed =
      nominees.length >= 4 ? [0, 1, 2, 3] : nominees.length === 3 ? [1, 2, 3] : [1, 2];
    const shuffledPts = pickRandom(allowed, allowed.length);
    try {
      for (let i = 0; i < nominees.length; i++) {
        const targetUserId = nominees[i]!;
        const points = shuffledPts[i] ?? allowed[i % allowed.length]!;
        await prisma.rankingVote.upsert({
          where: {
            gameId_roundNumber_voterUserId_targetUserId: {
              gameId,
              roundNumber: game.roundNumber,
              voterUserId,
              targetUserId,
            },
          },
          update: { points },
          create: {
            gameId,
            roundNumber: game.roundNumber,
            voterUserId,
            targetUserId,
            points,
          },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  const target = Math.random() < 0.5 ? rr.nomineeAUserId : rr.nomineeBUserId;
  try {
    await prisma.evictionVote.upsert({
      where: {
        gameId_roundNumber_voterUserId: {
          gameId,
          roundNumber: game.roundNumber,
          voterUserId,
        },
      },
      update: { targetUserId: target },
      create: { gameId, roundNumber: game.roundNumber, voterUserId, targetUserId: target },
    });
    return true;
  } catch {
    return false;
  }
}

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
  const points = Math.floor(Math.random() * 3) + 1;
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
      create: {
        gameId,
        dayNumber: game.roundNumber,
        voterUserId,
        targetUserId: target,
        points,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function botJuryVote(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true },
  });
  if (!game || game.gameType !== "FROOKIES_BOT" || game.state !== "JURY_VOTE") return false;

  const finalists = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true },
  });
  if (finalists.length !== 2) return false;
  const target = finalists[Math.floor(Math.random() * 2)]!.userId;
  try {
    await prisma.juryVote.upsert({
      where: { gameId_voterUserId: { gameId, voterUserId } },
      update: { targetUserId: target },
      create: { gameId, voterUserId, targetUserId: target },
    });
    return true;
  } catch {
    return false;
  }
}

export async function performBotActions(
  gameId: string
): Promise<{ chat: number; nom: number; vote: number }> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      state: true,
      roundNumber: true,
      povUserId: true,
      hohUserId: true,
      frookiesPhase: true,
    },
  });
  if (!game) return { chat: 0, nom: 0, vote: 0 };
  const gameType = game.gameType;

  if (
    gameType !== "FASTING_BOT" &&
    gameType !== "CASTING_BOT" &&
    gameType !== "FROOKIES_BOT" &&
    gameType !== "ROOKIES_BOT"
  ) {
    return { chat: 0, nom: 0, vote: 0 };
  }

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: game.state === "JURY_VOTE" ? undefined : "ACTIVE" },
    select: {
      userId: true,
      status: true,
      eliminatedPlace: true,
      user: { select: { usernameLower: true } },
    },
  });

  const botPlayers = players.filter((p) => p.user.usernameLower.startsWith("bot_"));
  if (botPlayers.length === 0) return { chat: 0, nom: 0, vote: 0 };

  let chat = 0,
    nom = 0,
    vote = 0;

  // Priority: phase-specific bot roles
  if (gameType === "FROOKIES_BOT" && game.state === "ROUND_NOMINATE") {
    if (game.frookiesPhase === "POV_SAVE" && game.povUserId) {
      const povBot = botPlayers.find((p) => p.userId === game.povUserId);
      if (povBot && (await botFrookiesPovSave(gameId, povBot.userId))) nom++;
    }
    if (game.frookiesPhase === "HOH_RENOM" && game.hohUserId) {
      const hohBot = botPlayers.find((p) => p.userId === game.hohUserId);
      if (hohBot && (await botFrookiesHohRenom(gameId, hohBot.userId))) nom++;
    }
    if (!game.frookiesPhase && game.hohUserId) {
      const hohBot = botPlayers.find((p) => p.userId === game.hohUserId);
      if (hohBot && (await botNominate(gameId, hohBot.userId))) nom++;
    }
  }

  if (gameType === "ROOKIES_BOT" && game.state === "ROUND_NOMINATE" && game.hohUserId) {
    const hohBot = botPlayers.find((p) => p.userId === game.hohUserId);
    if (hohBot && (await botNominate(gameId, hohBot.userId))) nom++;
  }

  if (gameType === "FROOKIES_BOT" && game.state === "JURY_VOTE") {
    const juryBots = botPlayers.filter(
      (p) =>
        p.status !== "ACTIVE" &&
        p.eliminatedPlace != null &&
        p.eliminatedPlace >= 3 &&
        p.eliminatedPlace <= 9
    );
    for (const j of pickRandom(juryBots, Math.min(5, juryBots.length))) {
      if (await botJuryVote(gameId, j.userId)) vote++;
    }
  }

  const toAct = pickRandom(
    botPlayers.filter((p) => p.status === "ACTIVE"),
    Math.min(4, botPlayers.length)
  );

  for (const p of toAct) {
    const r = Math.random();
    if (r < 0.35) {
      if (await botSendChat(gameId, p.userId)) chat++;
    } else if (gameType === "FASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") {
      if (game.state === "ROUND_NOMINATE" && !game.frookiesPhase && gameType === "FASTING_BOT" && r < 0.75) {
        if (await botNominate(gameId, p.userId)) nom++;
      } else if (game.state === "ROUND_VOTE" && r < 0.8) {
        if (await botVoteFasting(gameId, p.userId)) vote++;
      }
    } else if (gameType === "CASTING_BOT") {
      if (game.state === "ROUND_VOTE" && r < 0.8) {
        if (await botVoteCasting(gameId, p.userId)) vote++;
      }
    }
  }

  // Ensure most active bots vote before phase ends
  if (
    (gameType === "FASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") &&
    game.state === "ROUND_VOTE"
  ) {
    for (const p of pickRandom(
      botPlayers.filter((b) => b.status === "ACTIVE"),
      Math.min(8, botPlayers.length)
    )) {
      if (await botVoteFasting(gameId, p.userId)) vote++;
    }
  }

  return { chat, nom, vote };
}
