import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { finishTribalAndSpawnMerge } from "@/lib/survivor/merge";
import { assignEqualSitOuts } from "@/lib/survivor/sitOuts";
import { survivorPhaseMs } from "@/lib/survivor/timing";

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

async function tickMeters(gameId: string, merged: boolean) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      tribeAFood: true,
      tribeAWater: true,
      tribeAFire: true,
      tribeBFood: true,
      tribeBWater: true,
      tribeBFire: true,
    },
  });
  if (!game) return;

  if (!merged) {
    await prisma.game.update({
      where: { id: gameId },
      data: {
        tribeAFood: Math.max(0, game.tribeAFood - 1),
        tribeAWater: Math.max(0, game.tribeAWater - 1),
        tribeBFood: Math.max(0, game.tribeBFood - 1),
        tribeBWater: Math.max(0, game.tribeBWater - 1),
      },
    });
  }

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, food: true, water: true, health: true, tribe: true },
  });

  for (const p of actives) {
    let food = Math.max(0, p.food - 1);
    let water = Math.max(0, p.water - 1);
    let health = p.health;
    if (food === 0 || water === 0) health = Math.max(0, health - 10);
    if (!merged) {
      const fire =
        p.tribe === "A" ? game.tribeAFire : p.tribe === "B" ? game.tribeBFire : true;
      if (!fire) health = Math.max(0, health - 5);
    }
    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: p.userId } },
      data: { food, water, health },
    });
  }

  const dead = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", health: { lte: 0 } },
    select: { userId: true },
  });
  if (dead.length) {
    const remaining = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    let place = remaining;
    const systemUserId = await getSystemUserId();
    for (const d of dead) {
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: d.userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: new Date(),
          eliminatedPlace: place,
        },
      });
      place--;
      await prisma.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] A castaway was medically evacuated (health 0).`,
        },
      });
    }
  }
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
    for (let i = 0; i < actives.length; i++) {
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: actives[i].userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: i + 1,
        },
      });
    }
    await tx.game.update({
      where: { id: gameId },
      data: {
        state: "COMPLETED",
        completedAt: now,
        stateEndsAt: null,
        survivorPhase: null,
      },
    });
    await tx.gameMessage.create({
      data: {
        gameId,
        userId: systemUserId,
        channel: "PUBLIC",
        body: `[SYSTEM] Survivor finished! Winner: ${actives[0]?.user.username ?? "?"}`,
      },
    });
  });

  if (!isBot && actives[0]) {
    await prisma.user.update({
      where: { id: actives[0].userId },
      data: { karma: { increment: 50 }, tMoney: { increment: 40 } },
    });
  }
  if (!isBot && actives[1]) {
    await prisma.user.update({
      where: { id: actives[1].userId },
      data: { karma: { increment: 20 }, tMoney: { increment: 20 } },
    });
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

  const remaining = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  const place = remaining;
  const victim = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId: target } },
    include: { user: { select: { username: true } } },
  });

  await prisma.gamePlayer.update({
    where: { gameId_userId: { gameId, userId: target } },
    data: {
      status: "ELIMINATED",
      eliminatedAt: new Date(),
      eliminatedPlace: place,
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
      await tickMeters(gameId, false);

      const activeCount = await prisma.gamePlayer.count({
        where: { gameId, status: "ACTIVE" },
      });

      if (activeCount <= 2) {
        await finishSurvivor(gameId, isBot);
        return { ok: true as const, advanced: true as const, finished: true as const };
      }

      if (activeCount <= 10) {
        await finishTribalAndSpawnMerge(gameId, game.gameType);
        return { ok: true as const, advanced: true as const, merged: true as const };
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

  // ---------- Post-merge individual ----------
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
    await tickMeters(gameId, true);

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
