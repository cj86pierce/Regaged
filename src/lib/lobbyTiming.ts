import { prisma } from "@/lib/prisma";
import { fillGameWithBots } from "@/lib/botUsers";
import { tryStartFastingGame, tryStartFastingStyleGame } from "@/lib/gameEngine";
import { tryStartCastingsGame } from "@/lib/gameEngineCastings";
import {
  tryStartFastingBotGame,
  tryStartFastingStyleBotGame,
  tryStartCastingBotGame,
} from "@/lib/gameEngineBot";
import { tryStartSurvivorGame } from "@/lib/survivor/start";
import { SURVIVOR_MAX } from "@/lib/survivor/timing";

/** Live lobbies wait this long, then empty seats fill with bots. */
export const LOBBY_WAIT_MS = 15 * 60 * 1000;

/** @deprecated use LOBBY_WAIT_MS */
export const BOT_FILL_WAIT_MS = LOBBY_WAIT_MS;

const BOT_TYPES = [
  "FASTING_BOT",
  "CASTING_BOT",
  "FROOKIES_BOT",
  "ROOKIES_BOT",
  "SURVIVOR_BOT",
] as const;

const LIVE_TYPES = ["FASTING", "CASTING", "FROOKIES", "ROOKIES", "SURVIVOR"] as const;

export type BotGameType = (typeof BOT_TYPES)[number];
export type LiveGameType = (typeof LIVE_TYPES)[number];

export function isBotGameType(t: string): t is BotGameType {
  return (BOT_TYPES as readonly string[]).includes(t);
}

export function isLiveGameType(t: string): t is LiveGameType {
  return (LIVE_TYPES as readonly string[]).includes(t);
}

export function lobbyReadyAtFromCreated(createdAt: Date): Date {
  return new Date(createdAt.getTime() + LOBBY_WAIT_MS);
}

/** @deprecated use lobbyReadyAtFromCreated */
export function botFillAtFromCreated(createdAt: Date): Date {
  return lobbyReadyAtFromCreated(createdAt);
}

export function lobbyCap(gameType: string, survivorIsMerge?: boolean): number {
  if (gameType === "CASTING" || gameType === "CASTING_BOT") return 20;
  if (gameType === "SURVIVOR" || gameType === "SURVIVOR_BOT") {
    return survivorIsMerge ? 10 : SURVIVOR_MAX;
  }
  return 15;
}

/** @deprecated use lobbyCap */
export function botLobbyCap(gameType: string, survivorIsMerge?: boolean): number {
  return lobbyCap(gameType, survivorIsMerge);
}

async function startByType(gameId: string, gameType: string) {
  if (gameType === "FASTING") await tryStartFastingGame(gameId);
  else if (gameType === "FROOKIES" || gameType === "ROOKIES") {
    await tryStartFastingStyleGame(gameId, gameType);
  } else if (gameType === "CASTING") await tryStartCastingsGame(gameId);
  else if (gameType === "SURVIVOR") await tryStartSurvivorGame(gameId, "SURVIVOR");
  else if (gameType === "FASTING_BOT") await tryStartFastingBotGame(gameId);
  else if (gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") {
    await tryStartFastingStyleBotGame(gameId, gameType);
  } else if (gameType === "SURVIVOR_BOT") await tryStartSurvivorGame(gameId, "SURVIVOR_BOT");
  else if (gameType === "CASTING_BOT") await tryStartCastingBotGame(gameId);
}

/**
 * Live lobbies: start immediately if human-full; otherwise wait 15m then
 * fill empty seats with bots and start. Merge Survivor skips the wait.
 */
export async function maybeStartLiveLobby(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      createdAt: true,
      survivorIsMerge: true,
    },
  });
  if (!game || game.state !== "ENROLLING" || !isLiveGameType(game.gameType)) {
    return { ok: false as const, reason: "skip" as const };
  }

  if (game.gameType === "SURVIVOR" && game.survivorIsMerge) {
    await tryStartSurvivorGame(gameId, "SURVIVOR");
    return { ok: true as const, started: true as const, merge: true as const };
  }

  const max = lobbyCap(game.gameType, game.survivorIsMerge);
  const count = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });

  // Full of humans → start now (no bot wait).
  if (count >= max) {
    await startByType(gameId, game.gameType);
    return { ok: true as const, started: true as const };
  }

  const readyAt = lobbyReadyAtFromCreated(game.createdAt);
  if (Date.now() < readyAt.getTime()) {
    return { ok: true as const, waiting: true as const, readyAt: readyAt.toISOString() };
  }

  await fillGameWithBots(gameId, max);
  await startByType(gameId, game.gameType);
  return { ok: true as const, filled: true as const };
}

/**
 * Practice bot lobbies: fill empty seats immediately and start.
 * Merge skips pad-to-max.
 */
export async function maybeFillAndStartBotLobby(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      gameType: true,
      state: true,
      survivorIsMerge: true,
    },
  });
  if (!game || game.state !== "ENROLLING" || !isBotGameType(game.gameType)) {
    return { ok: false as const, reason: "skip" as const };
  }

  if (game.gameType === "SURVIVOR_BOT" && game.survivorIsMerge) {
    await tryStartSurvivorGame(gameId, "SURVIVOR_BOT");
    return { ok: true as const, started: true as const, merge: true as const };
  }

  const max = lobbyCap(game.gameType, game.survivorIsMerge);
  await fillGameWithBots(gameId, max);
  await startByType(gameId, game.gameType);
  return { ok: true as const, filled: true as const };
}

/** Tick helper: advance any ENROLLING lobby that is due. */
export async function maybeStartEnrollingLobby(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameType: true, state: true },
  });
  if (!game || game.state !== "ENROLLING") return { ok: false as const, reason: "skip" as const };
  if (isBotGameType(game.gameType)) return maybeFillAndStartBotLobby(gameId);
  if (isLiveGameType(game.gameType)) return maybeStartLiveLobby(gameId);
  return { ok: false as const, reason: "skip" as const };
}
