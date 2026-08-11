/**
 * Bot actions for practice modes: nominate, vote, chat, POV save, jury, survivor tribal.
 */
import { prisma } from "@/lib/prisma";

const CHAT_LINES = [
  "ngl this round feels rough",
  "who's actually playing rn",
  "i'm locking in",
  "don't sleep on me",
  "ok hear me out",
  "that was close",
  "we need to talk strategy",
  "i'm voting my gut",
  "respect if you pull this off",
  "someone's gotta go",
  "lowkey nervous",
  "let's just play clean",
  "i've been quiet but i'm watching",
  "good luck everyone",
  "this lobby is wild",
  "not today",
  "hmm interesting pick",
  "i'm down to make a move",
  "stay focused",
  "alright let's go",
  "chip damage adds up",
  "trust the process",
  "big phase coming",
  "i see you",
  "fair play",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function isBotEmail(email: string | null | undefined) {
  return !!email?.endsWith("@regaged.bot");
}

function isBotUsername(usernameLower: string | null | undefined) {
  return !!usernameLower?.startsWith("bot_");
}

/** Weighted pick: prefer higher weight. */
function weightedPick(ids: string[], weightOf: (id: string) => number): string {
  if (ids.length === 1) return ids[0]!;
  let total = 0;
  const weights = ids.map((id) => {
    const w = Math.max(0.05, weightOf(id));
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return ids[i]!;
  }
  return ids[ids.length - 1]!;
}

export async function botSendChat(gameId: string, userId: string): Promise<boolean> {
  const msg = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]!;
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

  const already = await prisma.nomination.count({
    where: { gameId, roundNumber: game.roundNumber, voterUserId },
  });
  if (already > 0 && !isHohMode) return false;

  const activeCount = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const frookiesFinalThree = game.gameType === "FROOKIES_BOT" && activeCount <= 3;
  const exclude = new Set<string>(
    [
      frookiesFinalThree ? null : game.povUserId,
      frookiesFinalThree ? null : game.povSavedUserId,
      isHohMode ? game.hohUserId : null,
    ].filter(Boolean) as string[]
  );
  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", ...(exclude.size ? { userId: { notIn: [...exclude] } } : {}) },
    select: {
      userId: true,
      chatCount: true,
      lastActiveAt: true,
      castingDayMiniGameScore: true,
      user: { select: { email: true } },
    },
  });
  const targets = players.filter((p) => p.userId !== voterUserId);
  if (targets.length === 0) return false;

  // Prefer quieter / lower-score humans slightly (feels more strategic).
  const weightOf = (id: string) => {
    const t = targets.find((p) => p.userId === id)!;
    const quiet = 1 / (1 + (t.chatCount ?? 0));
    const score = 1 / (1 + (t.castingDayMiniGameScore ?? 0) / 1_000_000);
    const humanBoost = isBotEmail(t.user.email) ? 0.85 : 1.15;
    return quiet * score * humanBoost;
  };

  if (isHohMode) {
    const pool = [...targets];
    const first = weightedPick(
      pool.map((t) => t.userId),
      weightOf
    );
    const rest = pool.filter((t) => t.userId !== first);
    if (rest.length === 0) return false;
    const second = weightedPick(
      rest.map((t) => t.userId),
      weightOf
    );
    try {
      await prisma.nomination.deleteMany({
        where: { gameId, roundNumber: game.roundNumber, voterUserId },
      });
      await prisma.nomination.createMany({
        data: [first, second].map((targetUserId) => ({
          gameId,
          roundNumber: game.roundNumber,
          voterUserId,
          targetUserId,
        })),
      });
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: voterUserId } },
        data: { lastActiveAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  const target = weightedPick(
    targets.map((t) => t.userId),
    weightOf
  );
  try {
    await prisma.nomination.create({
      data: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId,
        targetUserId: target,
      },
    });
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
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
  // Prefer self-save ~55% when eligible.
  const save =
    uniq.includes(povUserId) && Math.random() < 0.55
      ? povUserId
      : uniq[Math.floor(Math.random() * uniq.length)]!;
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
    select: { userId: true, chatCount: true, user: { select: { email: true } } },
  });
  if (pool.length === 0) return false;
  const replacement = weightedPick(
    pool.map((p) => p.userId),
    (id) => {
      const p = pool.find((x) => x.userId === id)!;
      return (1 / (1 + (p.chatCount ?? 0))) * (isBotEmail(p.user.email) ? 0.9 : 1.1);
    }
  );

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

  const existing = await prisma.evictionVote.findUnique({
    where: {
      gameId_roundNumber_voterUserId: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId,
      },
    },
    select: { voterUserId: true },
  });
  const existingRank = await prisma.rankingVote.count({
    where: { gameId, roundNumber: game.roundNumber, voterUserId },
  });

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

  const nomPlayers = await prisma.gamePlayer.findMany({
    where: { gameId, userId: { in: nominees } },
    select: {
      userId: true,
      chatCount: true,
      castingDayMiniGameScore: true,
      user: { select: { email: true } },
    },
  });

  // Rookies ranking when 3+ nominees
  if (game.gameType === "ROOKIES_BOT" && nominees.length >= 3) {
    if (existingRank > 0) return false;
    const allowed =
      nominees.length >= 4 ? [0, 1, 2, 3] : nominees.length === 3 ? [1, 2, 3] : [1, 2];
    // Rank quieter / weaker nominees as more likely to get higher "evict" points.
    const ordered = [...nominees].sort((a, b) => {
      const pa = nomPlayers.find((p) => p.userId === a);
      const pb = nomPlayers.find((p) => p.userId === b);
      const scoreA = (pa?.chatCount ?? 0) + (pa?.castingDayMiniGameScore ?? 0) / 1e6;
      const scoreB = (pb?.chatCount ?? 0) + (pb?.castingDayMiniGameScore ?? 0) / 1e6;
      return scoreA - scoreB + (Math.random() - 0.5);
    });
    const ptsSorted = [...allowed].sort((a, b) => b - a);
    try {
      for (let i = 0; i < ordered.length; i++) {
        const targetUserId = ordered[i]!;
        const points = ptsSorted[i] ?? allowed[i % allowed.length]!;
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
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: voterUserId } },
        data: { lastActiveAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  if (existing) return false;

  const target = weightedPick(nominees, (id) => {
    const p = nomPlayers.find((x) => x.userId === id);
    const quiet = 1 / (1 + (p?.chatCount ?? 0));
    const humanBoost = isBotEmail(p?.user.email) ? 0.9 : 1.2;
    return quiet * humanBoost;
  });
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
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/** Casting: assign 1/2/3 across all nominees like a real ballot. */
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

  const nominees = day.nomineeUserIds.filter((id) => id !== voterUserId);
  if (!nominees.length) return false;

  const already = await prisma.castingVote.count({
    where: { gameId, dayNumber: game.roundNumber, voterUserId },
  });
  if (already > 0) return false;

  const nomPlayers = await prisma.gamePlayer.findMany({
    where: { gameId, userId: { in: nominees } },
    select: {
      userId: true,
      chatCount: true,
      castingDayMiniGameScore: true,
      user: { select: { email: true } },
    },
  });

  const ordered = [...nominees].sort((a, b) => {
    const pa = nomPlayers.find((p) => p.userId === a);
    const pb = nomPlayers.find((p) => p.userId === b);
    const scoreA =
      (pa?.chatCount ?? 0) * 10 +
      (pa?.castingDayMiniGameScore ?? 0) / 1e6 +
      (isBotEmail(pa?.user.email) ? 0 : 2);
    const scoreB =
      (pb?.chatCount ?? 0) * 10 +
      (pb?.castingDayMiniGameScore ?? 0) / 1e6 +
      (isBotEmail(pb?.user.email) ? 0 : 2);
    // Weaker / quieter get more eviction points (higher number)
    return scoreA - scoreB + (Math.random() - 0.5) * 3;
  });

  const maxPts = Math.min(3, ordered.length);
  const pointValues = shuffleInPlace(Array.from({ length: maxPts }, (_, i) => i + 1)).sort(
    (a, b) => b - a
  );

  try {
    for (let i = 0; i < ordered.length; i++) {
      const points = i < pointValues.length ? pointValues[i]! : 1;
      await prisma.castingVote.create({
        data: {
          gameId,
          dayNumber: game.roundNumber,
          voterUserId,
          targetUserId: ordered[i]!,
          points,
        },
      });
    }
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
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

  const existing = await prisma.juryVote.findUnique({
    where: { gameId_voterUserId: { gameId, voterUserId } },
    select: { voterUserId: true },
  });
  if (existing) return false;

  const finalists = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: {
      userId: true,
      chatCount: true,
      user: { select: { email: true } },
    },
  });
  if (finalists.length !== 2) return false;
  const target = weightedPick(
    finalists.map((f) => f.userId),
    (id) => {
      const f = finalists.find((x) => x.userId === id)!;
      return 1 + (f.chatCount ?? 0) * 0.15 + (isBotEmail(f.user.email) ? 0 : 0.35);
    }
  );
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

/** Survivor tribal: bots on the losing tribe cast a vote. */
export async function botVoteSurvivor(gameId: string, voterUserId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameType: true,
      state: true,
      roundNumber: true,
      survivorPhase: true,
      losingTribe: true,
    },
  });
  if (
    !game ||
    game.gameType !== "SURVIVOR_BOT" ||
    game.state !== "ROUND_VOTE" ||
    game.survivorPhase !== "TRIBAL_COUNCIL"
  ) {
    return false;
  }

  const voter = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: voterUserId } },
    select: { tribe: true, status: true },
  });
  if (!voter || voter.status !== "ACTIVE" || voter.tribe !== game.losingTribe) return false;

  const existing = await prisma.evictionVote.findUnique({
    where: {
      gameId_roundNumber_voterUserId: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId,
      },
    },
  });
  if (existing) return false;

  const eligible = await prisma.gamePlayer.findMany({
    where: {
      gameId,
      status: "ACTIVE",
      tribe: game.losingTribe ?? undefined,
      hasImmunity: false,
      userId: { not: voterUserId },
    },
    select: {
      userId: true,
      chatCount: true,
      challengeScore: true,
      user: { select: { email: true } },
    },
  });
  if (!eligible.length) return false;

  const target = weightedPick(
    eligible.map((e) => e.userId),
    (id) => {
      const e = eligible.find((x) => x.userId === id)!;
      const weak = 1 / (1 + e.challengeScore / 1e7);
      const quiet = 1 / (1 + (e.chatCount ?? 0));
      return weak * quiet * (isBotEmail(e.user.email) ? 0.95 : 1.2);
    }
  );

  try {
    await prisma.evictionVote.create({
      data: {
        gameId,
        roundNumber: game.roundNumber,
        voterUserId,
        targetUserId: target,
      },
    });
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: voterUserId } },
      data: { lastActiveAt: new Date() },
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
      survivorPhase: true,
      losingTribe: true,
    },
  });
  if (!game) return { chat: 0, nom: 0, vote: 0 };
  const gameType = game.gameType;

  const supported =
    gameType === "FASTING_BOT" ||
    gameType === "CASTING_BOT" ||
    gameType === "FROOKIES_BOT" ||
    gameType === "ROOKIES_BOT" ||
    gameType === "SURVIVOR_BOT";
  if (!supported) return { chat: 0, nom: 0, vote: 0 };

  const players = await prisma.gamePlayer.findMany({
    where: { gameId, status: game.state === "JURY_VOTE" ? undefined : "ACTIVE" },
    select: {
      userId: true,
      status: true,
      eliminatedPlace: true,
      tribe: true,
      user: { select: { usernameLower: true, email: true } },
    },
  });

  const botPlayers = players.filter(
    (p) => isBotUsername(p.user.usernameLower) || isBotEmail(p.user.email)
  );
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

  // Fasting: every active bot nominates
  if (gameType === "FASTING_BOT" && game.state === "ROUND_NOMINATE") {
    for (const p of botPlayers.filter((b) => b.status === "ACTIVE")) {
      if (await botNominate(gameId, p.userId)) nom++;
    }
  }

  // All jury bots vote
  if (gameType === "FROOKIES_BOT" && game.state === "JURY_VOTE") {
    const juryBots = botPlayers.filter(
      (p) =>
        p.status !== "ACTIVE" &&
        p.eliminatedPlace != null &&
        p.eliminatedPlace >= 3 &&
        p.eliminatedPlace <= 9
    );
    for (const j of juryBots) {
      if (await botJuryVote(gameId, j.userId)) vote++;
    }
  }

  // All active bots cast eviction / casting votes
  if (
    (gameType === "FASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") &&
    game.state === "ROUND_VOTE"
  ) {
    for (const p of botPlayers.filter((b) => b.status === "ACTIVE")) {
      if (await botVoteFasting(gameId, p.userId)) vote++;
    }
  }

  if (gameType === "CASTING_BOT" && game.state === "ROUND_VOTE") {
    for (const p of botPlayers.filter((b) => b.status === "ACTIVE")) {
      if (await botVoteCasting(gameId, p.userId)) vote++;
    }
  }

  if (
    gameType === "SURVIVOR_BOT" &&
    game.state === "ROUND_VOTE" &&
    game.survivorPhase === "TRIBAL_COUNCIL"
  ) {
    for (const p of botPlayers.filter(
      (b) => b.status === "ACTIVE" && b.tribe === game.losingTribe
    )) {
      if (await botVoteSurvivor(gameId, p.userId)) vote++;
    }
  }

  // Natural chat: a few bots each tick, staggered feel
  const chatters = pickRandom(
    botPlayers.filter((p) => p.status === "ACTIVE"),
    Math.min(3, botPlayers.length)
  );
  for (const p of chatters) {
    if (Math.random() < 0.45 && (await botSendChat(gameId, p.userId))) chat++;
  }

  // Progressive challenge scores so humans see bots "playing" mid-phase
  try {
    if (
      gameType === "SURVIVOR_BOT" &&
      game.state === "ROUND_NOMINATE" &&
      (game.survivorPhase === "TRIBE_CHALLENGE" ||
        game.survivorPhase === "INDIVIDUAL_CHALLENGE" ||
        game.survivorPhase === "IMMUNITY")
    ) {
      const { pickMinigameForDay } = await import("@/lib/minigamePicker");
      const { sampleBotChallengeScore } = await import("@/lib/minigames/registry");
      const minigameId = pickMinigameForDay(gameId, game.roundNumber ?? 1);
      const unset = await prisma.gamePlayer.findMany({
        where: {
          gameId,
          status: "ACTIVE",
          sittingOut: false,
          challengeScore: 0,
          user: { email: { endsWith: "@regaged.bot" } },
        },
        select: { userId: true },
        take: 6,
      });
      for (const p of unset) {
        await prisma.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: p.userId } },
          data: { challengeScore: sampleBotChallengeScore(minigameId), lastActiveAt: new Date() },
        });
      }
    }

    if (gameType === "CASTING_BOT" && game.state === "ROUND_NOMINATE") {
      const { pickMinigameForDay } = await import("@/lib/minigamePicker");
      const { sampleBotChallengeScore } = await import("@/lib/minigames/registry");
      const minigameId = pickMinigameForDay(gameId, game.roundNumber ?? 1);
      const unset = await prisma.gamePlayer.findMany({
        where: {
          gameId,
          status: "ACTIVE",
          castingDayMiniGameScore: 0,
          user: { email: { endsWith: "@regaged.bot" } },
        },
        select: { userId: true },
        take: 5,
      });
      for (const p of unset) {
        await prisma.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: p.userId } },
          data: {
            castingDayMiniGameScore: sampleBotChallengeScore(minigameId),
            lastActiveAt: new Date(),
          },
        });
      }
    }
  } catch {
    // non-fatal
  }

  return { chat, nom, vote };
}
