import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { SURVIVOR_DAY_MS } from "@/lib/survivor/timing";

export type Weather = "SUN" | "RAIN" | "CLOUDY";
export type CampTribe = "A" | "B";

const WEATHERS: Weather[] = ["SUN", "RAIN", "CLOUDY"];

function isBotGame(gameType: string) {
  return gameType === "SURVIVOR_BOT";
}

/** Sun gather cooldown / rain collect duration (wiki: 30m sun, up to 2h rain). */
export function gatherSunMs(isBot: boolean) {
  return isBot ? 20_000 : 30 * 60 * 1000;
}
export function gatherRainMs(isBot: boolean) {
  return isBot ? 60_000 : 2 * 60 * 60 * 1000;
}
export function fireOutMs(isBot: boolean) {
  return isBot ? 45_000 : Math.floor(SURVIVOR_DAY_MS * (0.35 + Math.random() * 0.4));
}

function pickWeather(): Weather {
  const r = Math.random();
  if (r < 0.45) return "SUN";
  if (r < 0.75) return "RAIN";
  return "CLOUDY";
}

function campKey(tribe: CampTribe) {
  return tribe === "A"
    ? {
        food: "tribeAFood" as const,
        water: "tribeAWater" as const,
        fire: "tribeAFire" as const,
        weather: "tribeAWeather" as const,
        gatherReadyAt: "tribeAGatherReadyAt" as const,
        rainUntil: "tribeARainUntil" as const,
        fireUntil: "tribeAFireUntil" as const,
      }
    : {
        food: "tribeBFood" as const,
        water: "tribeBWater" as const,
        fire: "tribeBFire" as const,
        weather: "tribeBWeather" as const,
        gatherReadyAt: "tribeBGatherReadyAt" as const,
        rainUntil: "tribeBRainUntil" as const,
        fireUntil: "tribeBFireUntil" as const,
      };
}

export function resolvePlayerCampTribe(tribe: string | null | undefined, merged: boolean): CampTribe | null {
  if (merged) return "A";
  if (tribe === "A" || tribe === "B") return tribe;
  return null;
}

/** Relight fire if timer elapsed; clear finished rain. */
export async function syncCampTimers(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      tribeAFire: true,
      tribeBFire: true,
      tribeAFireUntil: true,
      tribeBFireUntil: true,
      tribeARainUntil: true,
      tribeBRainUntil: true,
      tribeAFood: true,
      tribeAWater: true,
      tribeBFood: true,
      tribeBWater: true,
    },
  });
  if (!game) return null;
  const now = Date.now();
  const data: Record<string, unknown> = {};

  if (!game.tribeAFire && game.tribeAFireUntil && game.tribeAFireUntil.getTime() <= now) {
    data.tribeAFire = true;
    data.tribeAFireUntil = null;
  }
  if (!game.tribeBFire && game.tribeBFireUntil && game.tribeBFireUntil.getTime() <= now) {
    data.tribeBFire = true;
    data.tribeBFireUntil = null;
  }
  // Rain finished: credit stock if not already credited (rainUntil in past means gather completed)
  if (game.tribeARainUntil && game.tribeARainUntil.getTime() <= now) {
    data.tribeARainUntil = null;
    data.tribeAWater = game.tribeAWater + 10;
  }
  if (game.tribeBRainUntil && game.tribeBRainUntil.getTime() <= now) {
    data.tribeBRainUntil = null;
    data.tribeBWater = game.tribeBWater + 10;
  }

  if (Object.keys(data).length) {
    return prisma.game.update({ where: { id: gameId }, data });
  }
  return game;
}

export async function initCampOnStart(gameId: string) {
  const now = new Date();
  await prisma.game.update({
    where: { id: gameId },
    data: {
      tribeAFood: 40,
      tribeAWater: 40,
      tribeBFood: 40,
      tribeBWater: 40,
      tribeAFire: true,
      tribeBFire: true,
      tribeAWeather: pickWeather(),
      tribeBWeather: pickWeather(),
      tribeAGatherReadyAt: now,
      tribeBGatherReadyAt: now,
      tribeARainUntil: null,
      tribeBRainUntil: null,
      tribeAFireUntil: null,
      tribeBFireUntil: null,
    },
  });
}

/** Personal starting meters from health (wiki: higher health → more food/water). */
export function personalMetersFromHealth(health: number) {
  const h = Math.max(20, Math.min(100, health));
  return { food: h, water: h };
}

/**
 * Day change: personal −6% food / −5% water; weather refresh; fire may go out;
 * starvation risk if both personal meters are 0.
 */
export async function tickCampDay(gameId: string, opts: { merged: boolean; isBot: boolean }) {
  await syncCampTimers(gameId);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      tribeAFire: true,
      tribeBFire: true,
      tribeAFireUntil: true,
      tribeBFireUntil: true,
      gameType: true,
    },
  });
  if (!game) return;

  const now = new Date();
  const weatherUpdate = opts.merged
    ? { tribeAWeather: pickWeather() }
    : { tribeAWeather: pickWeather(), tribeBWeather: pickWeather() };

  const fireUpdate: Record<string, unknown> = { ...weatherUpdate };
  // Fire goes out sometimes; relights later on its own
  if (Math.random() < 0.4) {
    if (opts.merged || Math.random() < 0.5) {
      fireUpdate.tribeAFire = false;
      fireUpdate.tribeAFireUntil = new Date(now.getTime() + fireOutMs(opts.isBot));
    }
    if (!opts.merged && Math.random() < 0.5) {
      fireUpdate.tribeBFire = false;
      fireUpdate.tribeBFireUntil = new Date(now.getTime() + fireOutMs(opts.isBot));
    }
  }

  await prisma.game.update({ where: { id: gameId }, data: fireUpdate });

  const actives = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE" },
    select: { userId: true, food: true, water: true, health: true, tribe: true },
  });

  const systemUserId = await getSystemUserId();
  for (const p of actives) {
    let food = Math.max(0, p.food - 6);
    let water = Math.max(0, p.water - 5);
    let health = p.health;

    if (food === 0 && water === 0) {
      // Wiki: high chance of death on day change
      if (Math.random() < 0.55) health = 0;
      else health = Math.max(0, health - 25);
    } else if (food === 0 || water === 0) {
      health = Math.max(0, health - 10);
    }

    await prisma.gamePlayer.update({
      where: { gameId_userId: { gameId, userId: p.userId } },
      data: { food, water, health },
    });
  }

  const dead = await prisma.gamePlayer.findMany({
    where: { gameId, status: "ACTIVE", health: { lte: 0 } },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (dead.length) {
    const { SURVIVOR_MAX } = await import("@/lib/survivor/timing");
    for (const d of dead) {
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: d.userId } },
        data: {
          status: "ELIMINATED",
          eliminatedAt: now,
          eliminatedPlace: SURVIVOR_MAX, // 20th — only 1st / 20th in Survivor
        },
      });
      await prisma.gameMessage.create({
        data: {
          gameId,
          userId: systemUserId,
          channel: "PUBLIC",
          body: `[SYSTEM] ${d.user.username} was medically evacuated (starvation / health 0).`,
        },
      });
    }
  }
}

export async function campAction(opts: {
  gameId: string;
  userId: string;
  action: "eat" | "drink" | "gather";
  amount?: number;
}) {
  const game = await prisma.game.findUnique({
    where: { id: opts.gameId },
    select: {
      gameType: true,
      state: true,
      survivorMerged: true,
      tribeAFood: true,
      tribeAWater: true,
      tribeAFire: true,
      tribeBFood: true,
      tribeBWater: true,
      tribeBFire: true,
      tribeAWeather: true,
      tribeBWeather: true,
      tribeAGatherReadyAt: true,
      tribeBGatherReadyAt: true,
      tribeARainUntil: true,
      tribeBRainUntil: true,
      tribeAFireUntil: true,
      tribeBFireUntil: true,
    },
  });
  if (!game || (game.gameType !== "SURVIVOR" && game.gameType !== "SURVIVOR_BOT")) {
    return { ok: false as const, error: "Not a Survivor game" };
  }
  if (game.state === "ENROLLING" || game.state === "COMPLETED") {
    return { ok: false as const, error: "Camp closed" };
  }

  await syncCampTimers(opts.gameId);
  const fresh = await prisma.game.findUnique({ where: { id: opts.gameId } });
  if (!fresh) return { ok: false as const, error: "Game missing" };

  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: opts.gameId, userId: opts.userId } },
    select: { status: true, tribe: true, food: true, water: true, health: true },
  });
  if (!gp || gp.status !== "ACTIVE") return { ok: false as const, error: "Not in game" };

  const campTribe = resolvePlayerCampTribe(gp.tribe, fresh.survivorMerged);
  if (!campTribe) return { ok: false as const, error: "No camp" };

  const k = campKey(campTribe);
  const isBot = isBotGame(fresh.gameType);
  const now = new Date();
  const fireOn = !!fresh[k.fire];
  const weather = (fresh[k.weather] as Weather) || "SUN";
  const rainUntil = fresh[k.rainUntil] as Date | null;
  const raining = !!(rainUntil && rainUntil.getTime() > now.getTime());

  if (opts.action === "eat" || opts.action === "drink") {
    const amount = Math.min(10, Math.max(1, Math.trunc(Number(opts.amount) || 1)));
    if (!fireOn) {
      // Wiki: never eat/drink with fire out — drastic penalty
      const food = Math.max(0, gp.food - 20);
      const water = Math.max(0, gp.water - 20);
      const health = Math.max(0, gp.health - 30);
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: opts.gameId, userId: opts.userId } },
        data: { food, water, health },
      });
      return {
        ok: false as const,
        error: "Fire is out! Eating or drinking made you sick (−stats).",
        punished: true as const,
      };
    }
    if (opts.action === "drink" && raining) {
      return { ok: false as const, error: "Can't drink while the tribe is collecting rain." };
    }

    const stockKey = opts.action === "eat" ? k.food : k.water;
    const stock = fresh[stockKey] as number;
    if (stock < amount) return { ok: false as const, error: "Not enough tribe supplies." };

    // 1 stock → +5 personal %
    const gain = amount * 5;
    const personalKey = opts.action === "eat" ? "food" : "water";
    const nextPersonal = Math.min(100, (gp[personalKey] as number) + gain);

    await prisma.$transaction([
      prisma.game.update({
        where: { id: opts.gameId },
        data: { [stockKey]: stock - amount },
      }),
      prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: opts.gameId, userId: opts.userId } },
        data: { [personalKey]: nextPersonal, lastActiveAt: now },
      }),
    ]);

    return { ok: true as const, action: opts.action, amount, personal: nextPersonal };
  }

  // gather
  if (weather === "CLOUDY") {
    return { ok: false as const, error: "Cloudy — can't gather food or water." };
  }
  const readyAt = fresh[k.gatherReadyAt] as Date | null;
  if (readyAt && readyAt.getTime() > now.getTime()) {
    return { ok: false as const, error: "Gather not ready yet." };
  }
  if (raining) {
    return { ok: false as const, error: "Already collecting rain." };
  }

  if (weather === "SUN") {
    if (gp.water < 6) return { ok: false as const, error: "Need 6 personal water to hunt." };
    await prisma.$transaction([
      prisma.game.update({
        where: { id: opts.gameId },
        data: {
          [k.food]: (fresh[k.food] as number) + 10,
          [k.gatherReadyAt]: new Date(now.getTime() + gatherSunMs(isBot)),
        },
      }),
      prisma.gamePlayer.update({
        where: { gameId_userId: { gameId: opts.gameId, userId: opts.userId } },
        data: {
          water: Math.max(0, gp.water - 6),
          lastGatherAt: now,
          lastActiveAt: now,
        },
      }),
    ]);
    return { ok: true as const, action: "gather", kind: "FOOD" as const };
  }

  // RAIN — start collection; +10 water when rainUntil elapses
  if (gp.food < 6) return { ok: false as const, error: "Need 6 personal food to collect water." };
  const until = new Date(now.getTime() + gatherRainMs(isBot));
  await prisma.$transaction([
    prisma.game.update({
      where: { id: opts.gameId },
      data: {
        [k.rainUntil]: until,
        [k.gatherReadyAt]: until,
      },
    }),
    prisma.gamePlayer.update({
      where: { gameId_userId: { gameId: opts.gameId, userId: opts.userId } },
      data: {
        food: Math.max(0, gp.food - 6),
        lastGatherAt: now,
        lastActiveAt: now,
      },
    }),
  ]);
  return { ok: true as const, action: "gather", kind: "WATER" as const, rainUntil: until.toISOString() };
}

export function campPublicView(game: {
  survivorMerged: boolean;
  tribeAFood: number;
  tribeAWater: number;
  tribeAFire: boolean;
  tribeBFood: number;
  tribeBWater: number;
  tribeBFire: boolean;
  tribeAWeather?: string | null;
  tribeBWeather?: string | null;
  tribeAGatherReadyAt?: Date | null;
  tribeBGatherReadyAt?: Date | null;
  tribeARainUntil?: Date | null;
  tribeBRainUntil?: Date | null;
  tribeAFireUntil?: Date | null;
  tribeBFireUntil?: Date | null;
}) {
  return {
    tribeAFood: game.tribeAFood,
    tribeAWater: game.tribeAWater,
    tribeAFire: game.tribeAFire,
    tribeBFood: game.tribeBFood,
    tribeBWater: game.tribeBWater,
    tribeBFire: game.tribeBFire,
    tribeAWeather: (game.tribeAWeather as Weather) ?? "SUN",
    tribeBWeather: (game.tribeBWeather as Weather) ?? "SUN",
    tribeAGatherReadyAt: game.tribeAGatherReadyAt?.toISOString() ?? null,
    tribeBGatherReadyAt: game.tribeBGatherReadyAt?.toISOString() ?? null,
    tribeARainUntil: game.tribeARainUntil?.toISOString() ?? null,
    tribeBRainUntil: game.tribeBRainUntil?.toISOString() ?? null,
    tribeAFireUntil: game.tribeAFireUntil?.toISOString() ?? null,
    tribeBFireUntil: game.tribeBFireUntil?.toISOString() ?? null,
  };
}

export { WEATHERS, pickWeather };
