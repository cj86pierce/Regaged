import { prisma } from "@/lib/prisma";
import { SURVIVOR_MERGE_PRIZE } from "@/lib/gamePrizes";
import { getSystemUserId } from "@/lib/systemUser";
import { tickCampDay } from "@/lib/survivor/camp";
import { finishTribalAndSpawnMerge } from "@/lib/survivor/merge";
import { assignEqualSitOuts } from "@/lib/survivor/sitOuts";
import { SURVIVOR_MAX, survivorPhaseMs } from "@/lib/survivor/timing";

/** Survivor only records 1st (made it) or 20th (out). */
const SURVIVOR_LOSE_PLACE = SURVIVOR_MAX;
const SURVIVOR_WIN_PLACE = 1;

type Phase =
  | "TRIBE_CHALLENGE"
  | "IMMUNITY"
  | "TRIBAL_COUNCIL"
  | "INDIVIDUAL_CHALLENGE"
  | "INDIVIDUAL_IMMUNITY"
  | "VOTE";

function nextEnds(isBot: boolean) {
  return new Date(Date.now() + survivorPhaseMs(isBot));
}

async function resetScores(gameId: string) {
  await prisma.gamePlayer.updateMany({
    where: { gameId, status: "ACTIVE" },
    data: { challengeScore: 0, hasImmunity: false },
  });
}

async function finishSurvivor(gameId: string, isBot: boolean) {
  const now = new Date();
  const systemUserId = await getSystemUserId();
  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    include: { user: { select: { username: true } } },
    orderBy: [{ challengeScore: "desc" }, { plusCount: "desc" }, { chatCount: "desc" }],
  });

  await prisma.$transaction(async (tx) => {
    // Everyone still in places 1st; anyone already out should already be 20th.
    for (const a of actives) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: a.userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: SURVIVOR_WIN_PLACE,
        },
      });
    }
    await tx.gamePlayer.updateMany({
      where: {
        gameId,
        status: "ELIMINATED",
        eliminatedPlace: { not: SURVIVOR_WIN_PLACE },
      },
      data: { eliminatedPlace: SURVIVOR_LOSE_PLACE },
    });
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "COMPLETED",
        completedAt: now,
        stateEndsAt: null,
        survivorPhase: null,
      },
    });
    const names = actives.map((a) => a.user.username).join(", ");
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Survivor finished! 1st: ${names || "?"}. Everyone else: 20th.`,
      },
    });
  });

  if (!isBot) {
    const { applyPlacementPayout, isGameBotFilled } = await import("@/lib/botFillPayout");
    const botFilled = await isGameBotFilled(gameId);
    for (const a of actives) {
      await applyPlacementPayout(a.userId, SURVIVOR_MERGE_PRIZE.karma, SURVIVOR_MERGE_PRIZE.tMoney, { botFilled });
    }
  }
}

async function eliminateByVote(gameId: string, eligibleUserIds: string[], isBot: boolean) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { roundNumber: true },
  });
  if (!game) return null;

  const votes = await prisma.evictionVote.findMany({
    where: { gameId, roundNumber: game.roundNumber },
    select: { targetUserId: true },
  });

  const tallies = new Map<string, number>();
  for (const id of eligibleUserIds) tallies.set(id, 0);
  for (const v of votes) {
    if (tallies.has(v.targetUserId)) {
      tallies.set(v.targetUserId, (tallies.get(v.targetUserId) ?? 0) + 1);
    }
  }

  let target = eligibleUserIds[0] ?? null;
  let best = -1;
  for (const [uid, n] of tallies) {
    if (n > best) {
      best = n;
      target = uid;
    }
  }
  if (best <= 0 && eligibleUserIds.length) {
    const scored = await prisma.gamePlayer.findMany({
      where: { gameId, userId: { in: eligibleUserIds } },
      select: { userId: true, challengeScore: true },
      orderBy: { challengeScore: "asc" },
    });
    target = scored[0]?.userId ?? eligibleUserIds[0];
  }
  if (!target) return null;

  // Survivor placements are only 1st (made merge / finished) or 20th (out).
  const victim = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: target } },
    include: { user: { select: { username: true } } },
  });

  await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId: target } },
    data: {
      status: "ELIMINATED",
      eliminatedAt: new Date(),
      eliminatedPlace: SURVIVOR_LOSE_PLACE,
    },
  });

  const systemUserId = await getSystemUserId();
  await prisma.gameMessage.create({
    data: {
      gameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body: `[SYSTEM] ${victim?.user.username ?? "Someone"} has been voted out.`,
    },
  });

  return target;
}

/** Seed bot challenge scores if still 0 (competitors only). */
async function seedBotScores(gameId: string, tribeFilter?: string | null) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { roundNumber: true },
  });
  const { pickMinigameForDay } = await import("@/lib/minigamePicker");
  const { sampleBotChallengeScore } = await import("@/lib/minigames/registry");
  const minigameId = pickMinigameForDay(gameId, game?.roundNumber ?? 1);

  const where: {
    gameId: string;
    status: "ACTIVE";
    sittingOut: boolean;
    tribe?: string;
  } = {
    gameId,
    status: "ACTIVE",
    sittingOut: false,
  };
  if (tribeFilter) where.tribe = tribeFilter;
  const rows = await prisma.gamePlayer.findMany({
    where,
    select: { userId: true, challengeScore: true, user: { select: { email: true } } },
  });
  for (const r of rows) {
    if (r.challengeScore > 0) continue;
    const isBot = r.user.email?.endsWith("@regaged.bot");
    if (!isBot) continue;
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: r.userId } },
      data: { challengeScore: sampleBotChallengeScore(minigameId) },
    });
  }
}

async function resolveTribeChallenge(gameId: string, isBot: boolean, roundNumber: number) {
  const systemUserId = await getSystemUserId();
  await seedBotScores(gameId, "A");
  await seedBotScores(gameId, "B");

  const a = await prisma.gamePlayer.aggregate({
    where: { gameId, status: "ACTIVE", tribe: "A", sittingOut: false },
    _sum: { challengeScore: true },
  });
  const b = await prisma.gamePlayer.aggregate({
    where: { gameId, status: "ACTIVE", tribe: "B", sittingOut: false },
    _sum: { challengeScore: true },
  });
  const aScore = a._sum.challengeScore ?? 0;
  const bScore = b._sum.challengeScore ?? 0;
  const losing =
    aScore === bScore ? (Math.random() < 0.5 ? "A" : "B") : aScore > bScore ? "B" : "A";
  const winning = losing === "A" ? "B" : "A";

  await prisma.gamePlayer.updateMany({
    where: { gameId, status: "ACTIVE" },
    data: { hasImmunity: false },
  });

  const top = await prisma.gamePlayer.findFirst({
    where: {
      gameId,
      status: "ACTIVE",
      tribe: losing,
      sittingOut: false,
    },
    orderBy: { challengeScore: "desc" },
    select: { userId: true, user: { select: { username: true } } },
  });

  if (top) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: top.userId } },
      data: { hasImmunity: true },
    });
  }

  await prisma.gameMessage.create({
    data: {
      gameId,
      userId: systemUserId,
      channel: "PUBLIC",
      body:
        `[SYSTEM] Tribe ${winning} wins immunity (${winning === "A" ? aScore : bScore} vs ${losing === "A" ? aScore : bScore}). ` +
        (top
          ? `${top.user.username} has individual immunity on Tribe ${losing}. Tribal Council begins.`
          : `Tribe ${losing} goes to Tribal Council.`),
    },
  });

  await prisma.evictionVote.deleteMany({
    where: { gameId, roundNumber },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: {
      survivorPhase: "TRIBAL_COUNCIL",
      losingTribe: losing,
      state: "ROUND_VOTE",
      stateEndsAt: nextEnds(isBot),
    },
  });
}

async function resolveIndividualChallenge(gameId: string, isBot: boolean, roundNumber: number) {
  const systemUserId = await getSystemUserId();
  await seedBotScores(gameId, null);

  const top = await prisma.gamePlayer.findFirst({
    where: { gameId, status: "ACTIVE" },
    orderBy: { challengeScore: "desc" },
    select: { userId: true, user: { select: { username: true } } },
  });

  await prisma.gamePlayer.updateMany({
    where: { gameId, status: "ACTIVE" },
    data: { hasImmunity: false },
  });

  if (top) {
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: top.userId } },
      data: { hasImmunity: true },
    });
    await prisma.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] ${top.user.username} wins individual immunity.`,
      },
    });
  }

  await prisma.evictionVote.deleteMany({
    where: { gameId, roundNumber },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: {
      survivorPhase: "VOTE",
      state: "ROUND_VOTE",
      stateEndsAt: nextEnds(isBot),
    },
  });
}

export async function advanceSurvivorIfDue(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      stateEndsAt: true,
      survivorPhase: true,
      survivorMerged: true,
      survivorIsMerge: true,
      losingTribe: true,
      roundNumber: true,
    },
  });

  if (!game) return { ok: false as const };
  if (game.gameType !== "SURVIVOR" && game.gameType !== "SURVIVOR_BOT") {
    return { ok: false as const };
  }
  if (game.state === "ENROLLING" || game.state === "COMPLETED") {
    return { ok: true as const, skipped: true as const };
  }

  const now = new Date();
  if (game.stateEndsAt && game.stateEndsAt.getTime() > now.getTime()) {
    return { ok: true as const, skipped: true as const, reason: "not_due" as const };
  }

  const isBot = game.gameType === "SURVIVOR_BOT";
  const phase = (game.survivorPhase ?? "TRIBE_CHALLENGE") as Phase;

  // ---------- Pre-merge tribe loop ----------
  if (!game.survivorMerged) {
    if (phase === "TRIBE_CHALLENGE") {
      await resolveTribeChallenge(gameId, isBot, game.roundNumber);
      return { ok: true as const, advanced: true as const };
    }

    // Legacy mid-game: old IMMUNITY phase → finish with whatever scores remain
    if (phase === "IMMUNITY") {
      const losing = game.losingTribe ?? "A";
      await seedBotScores(gameId, losing);
      const top = await prisma.gamePlayer.findFirst({
        where: { gameId, status: "ACTIVE", tribe: losing, sittingOut: false },
        orderBy: { challengeScore: "desc" },
        select: { userId: true, user: { select: { username: true } } },
      });
      const systemUserId = await getSystemUserId();
      await prisma.gamePlayer.updateMany({
        where: { gameId, status: "ACTIVE" },
        data: { hasImmunity: false },
      });
      if (top) {
        await prisma.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: top.userId } },
          data: { hasImmunity: true },
        });
        await prisma.gameMessage.create({
          data: {
            gameId,
            userId: systemUserId,
            channel: "PUBLIC",
            body: `[SYSTEM] ${top.user.username} wins individual immunity at Tribal.`,
          },
        });
      }
      await prisma.evictionVote.deleteMany({
        where: { gameId, roundNumber: game.roundNumber },
      });
      await prisma.game.update({
        where: { id: gameId },
        data: {
          survivorPhase: "TRIBAL_COUNCIL",
          state: "ROUND_VOTE",
          stateEndsAt: nextEnds(isBot),
        },
      });
      return { ok: true as const, advanced: true as const };
    }

    if (phase === "TRIBAL_COUNCIL") {
      const losing = game.losingTribe ?? "A";
      const eligible = await prisma.gamePlayer.findMany({
        where: {
          gameId,
          status: "ACTIVE",
          tribe: losing,
          hasImmunity: false,
        },
        select: { userId: true },
      });

      if (isBot) {
        const voters = await prisma.gamePlayer.findMany({
          where: { gameId, status: "ACTIVE", tribe: losing },
          select: { userId: true, user: { select: { email: true } } },
        });
        const targets = eligible.map((e) => e.userId);
        for (const v of voters) {
          if (!v.user.email?.endsWith("@regaged.bot")) continue;
          if (!targets.length) continue;
          const target = targets[Math.floor(Math.random() * targets.length)];
          await prisma.evictionVote.upsert({
            where: {
              gameId_roundNumber_voterUserId: {
                gameId,
                roundNumber: game.roundNumber,
                voterUserId: v.userId,
              },
            },
            create: {
              gameId,
              roundNumber: game.roundNumber,
              voterUserId: v.userId,
              targetUserId: target,
            },
            update: { targetUserId: target },
          });
        }
      }

      await eliminateByVote(
        gameId,
        eligible.map((e) => e.userId),
        isBot
      );
      await tickCampDay(gameId, { merged: false, isBot });

      const activeCount = await prisma.gamePlayer.count({
        where: { gameId, status: "ACTIVE" },
      });

      // Final 2 always ends the season (tribal or merge stage).
      if (activeCount <= 2) {
        await finishSurvivor(gameId, isBot);
        return { ok: true as const, advanced: true as const, finished: true as const };
      }

      // First tribal stage → merge at ≤10. Merge stage keeps two tribes until final 2.
      // Bot tribal stops at merge (no endless second season).
      if (!game.survivorIsMerge && activeCount <= 10) {
        await finishTribalAndSpawnMerge(gameId, game.gameType);
        return { ok: true as const, advanced: true as const, merged: true as const };
      }

      // If one tribe is wiped, dissolve into individual immunity (one camp).
      const [aLeft, bLeft] = await Promise.all([
        prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE", tribe: "A" } }),
        prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE", tribe: "B" } }),
      ]);
      if (aLeft === 0 || bLeft === 0) {
        await prisma.gamePlayer.updateMany({
          where: { gameId, status: "ACTIVE" },
          data: { tribe: "MERGED", sittingOut: false, challengeScore: 0, hasImmunity: false },
        });
        await prisma.game.update({
          where: { id: gameId },
          data: {
            survivorMerged: true,
            survivorPhase: "INDIVIDUAL_CHALLENGE",
            state: "ROUND_NOMINATE",
            losingTribe: null,
            roundNumber: { increment: 1 },
            stateEndsAt: nextEnds(isBot),
          },
        });
        return { ok: true as const, advanced: true as const, dissolved: true as const };
      }

      await resetScores(gameId);
      await prisma.game.update({
        where: { id: gameId },
        data: {
          survivorPhase: "TRIBE_CHALLENGE",
          state: "ROUND_NOMINATE",
          losingTribe: null,
          roundNumber: { increment: 1 },
          stateEndsAt: nextEnds(isBot),
        },
      });
      await assignEqualSitOuts(gameId);
      return { ok: true as const, advanced: true as const };
    }
  }

  // ---------- Individual (only if a tribe was wiped) ----------
  if (phase === "INDIVIDUAL_CHALLENGE" || phase === "INDIVIDUAL_IMMUNITY") {
    await resolveIndividualChallenge(gameId, isBot, game.roundNumber);
    return { ok: true as const, advanced: true as const };
  }

  if (phase === "VOTE") {
    const eligible = await prisma.gamePlayer.findMany({
      where: { gameId, status: "ACTIVE", hasImmunity: false },
      select: { userId: true },
    });

    if (isBot) {
      const voters = await prisma.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, user: { select: { email: true } } },
      });
      const targets = eligible.map((e) => e.userId);
      for (const v of voters) {
        if (!v.user.email?.endsWith("@regaged.bot")) continue;
        if (!targets.length) continue;
        const target = targets[Math.floor(Math.random() * targets.length)];
        await prisma.evictionVote.upsert({
          where: {
            gameId_roundNumber_voterUserId: {
              gameId,
              roundNumber: game.roundNumber,
              voterUserId: v.userId,
            },
          },
          create: {
            gameId,
            roundNumber: game.roundNumber,
            voterUserId: v.userId,
            targetUserId: target,
          },
          update: { targetUserId: target },
        });
      }
    }

    await eliminateByVote(
      gameId,
      eligible.map((e) => e.userId),
      isBot
    );
    await tickCampDay(gameId, { merged: true, isBot });

    const activeCount = await prisma.gamePlayer.count({
      where: { gameId, status: "ACTIVE" },
    });

    if (activeCount <= 2) {
      await finishSurvivor(gameId, isBot);
      return { ok: true as const, advanced: true as const, finished: true as const };
    }

    await resetScores(gameId);
    await prisma.game.update({
      where: { id: gameId },
      data: {
        survivorPhase: "INDIVIDUAL_CHALLENGE",
        state: "ROUND_NOMINATE",
        roundNumber: { increment: 1 },
        stateEndsAt: nextEnds(isBot),
      },
    });
    return { ok: true as const, advanced: true as const };
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      survivorPhase: game.survivorMerged ? "INDIVIDUAL_CHALLENGE" : "TRIBE_CHALLENGE",
      state: "ROUND_NOMINATE",
      stateEndsAt: nextEnds(isBot),
    },
  });
  if (!game.survivorMerged) await assignEqualSitOuts(gameId);
  return { ok: true as const, advanced: true as const, fixed: true as const };
}
