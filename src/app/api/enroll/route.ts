import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isEmailVerified } from "@/lib/emailVerification";
import { tryStartFastingGame, tryStartFastingStyleGame } from "@/lib/gameEngine";
import { tryStartCastingsGame } from "@/lib/gameEngineCastings";
import { tryStartFastingBotGame, tryStartFastingStyleBotGame } from "@/lib/gameEngineBot";
import { tryStartCastingBotGame } from "@/lib/gameEngineBot";
import { fillGameWithBots } from "@/lib/botUsers";

const FASTING_MAX = 15;
const CASTING_MAX = 20;

type GameType = "FASTING" | "CASTING" | "FASTING_BOT" | "CASTING_BOT" | "FROOKIES" | "ROOKIES" | "FROOKIES_BOT" | "ROOKIES_BOT";

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isEmailVerified(userId))) {
    return NextResponse.json(
      { error: "Email verification required", redirect: "/profile/edit" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const gameType = (body?.gameType ?? "FASTING") as GameType;

  if (gameType !== "FASTING" && gameType !== "CASTING" && gameType !== "FASTING_BOT" && gameType !== "CASTING_BOT" && gameType !== "FROOKIES" && gameType !== "ROOKIES" && gameType !== "FROOKIES_BOT" && gameType !== "ROOKIES_BOT") {
    return NextResponse.json({ error: "Invalid gameType" }, { status: 400 });
  }

  // FROOKIES: Card Required = Yellow, Entrance = T$10
  if (gameType === "FROOKIES") {
    const yellow = await prisma.colorLevel.findUnique({ where: { name: "Yellow" }, select: { id: true } });
    const meForFrookies = await prisma.user.findUnique({
      where: { id: userId },
      select: { tMoney: true, equippedColorId: true },
    });
    if (!yellow || meForFrookies?.equippedColorId !== yellow.id) {
      return NextResponse.json(
        { error: "Yellow card required. Equip Yellow in Shop → Colors to play Frookies." },
        { status: 403 }
      );
    }
    if ((meForFrookies?.tMoney ?? 0) < 10) {
      return NextResponse.json(
        { error: "Entrance fee is T$10. You need more T$ to join." },
        { status: 403 }
      );
    }
  }

  // ROOKIES: Card Required = Yellow, Entrance = T$15
  if (gameType === "ROOKIES") {
    const yellow = await prisma.colorLevel.findUnique({ where: { name: "Yellow" }, select: { id: true } });
    const meForRookies = await prisma.user.findUnique({
      where: { id: userId },
      select: { tMoney: true, equippedColorId: true },
    });
    if (!yellow || meForRookies?.equippedColorId !== yellow.id) {
      return NextResponse.json(
        { error: "Yellow card required. Equip Yellow in Shop → Colors to play Rookies." },
        { status: 403 }
      );
    }
    if ((meForRookies?.tMoney ?? 0) < 15) {
      return NextResponse.json(
        { error: "Entrance fee is T$15. You need more T$ to join." },
        { status: 403 }
      );
    }
  }

  const MAX = gameType === "CASTING" || gameType === "CASTING_BOT" ? CASTING_MAX : FASTING_MAX;

  // ✅ Only redirect if already ACTIVE in THIS requested gameType
  const alreadySameType = await prisma.gamePlayer.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      game: {
        gameType,
        state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] },
      },
    },
    select: { gameId: true },
  });

  if (alreadySameType) return NextResponse.json({ ok: true, gameId: alreadySameType.gameId });

  // Find or create lobby for this gameType
  let lobby = await prisma.game.findFirst({
    where: { gameType, state: "ENROLLING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!lobby) {
    lobby = await prisma.game.create({
      data: { gameType, state: "ENROLLING", roundNumber: 0 },
      select: { id: true },
    });
  }

  // For bot modes: when human joins, immediately fill with bots and start
  const isBotMode = gameType === "FASTING_BOT" || gameType === "CASTING_BOT" || gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT";

  // Join lobby if not already
  const existing = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: lobby.id, userId } },
    select: { id: true },
  });

  if (!existing) {
    // FROOKIES: deduct entrance fee T$10
    if (gameType === "FROOKIES") {
      const updated = await prisma.user.updateMany({
        where: { id: userId, tMoney: { gte: 10 } },
        data: { tMoney: { decrement: 10 } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Not enough T$. Entrance fee is T$10." }, { status: 403 });
      }
    }
    // ROOKIES: deduct entrance fee T$15
    if (gameType === "ROOKIES") {
      const updated = await prisma.user.updateMany({
        where: { id: userId, tMoney: { gte: 15 } },
        data: { tMoney: { decrement: 15 } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Not enough T$. Entrance fee is T$15." }, { status: 403 });
      }
    }

    const takenRows = await prisma.gamePlayer.findMany({
      where: { gameId: lobby.id, seatIndex: { not: null } },
      select: { seatIndex: true },
    });

    const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
    const open: number[] = [];
    for (let i = 1; i <= MAX; i++) if (!taken.has(i)) open.push(i);

    const seat = open.length ? open[Math.floor(Math.random() * open.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId: lobby.id, userId, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });
  }

  // Start if full (or for bot modes, fill with bots then start)
  if (isBotMode) {
    await fillGameWithBots(lobby.id, MAX);
  }

  if (gameType === "FASTING") {
    await tryStartFastingGame(lobby.id);
  } else if (gameType === "FROOKIES" || gameType === "ROOKIES") {
    await tryStartFastingStyleGame(lobby.id, gameType);
  } else if (gameType === "CASTING") {
    await tryStartCastingsGame(lobby.id);
  } else if (gameType === "FASTING_BOT") {
    await tryStartFastingBotGame(lobby.id);
  } else if (gameType === "FROOKIES_BOT" || gameType === "ROOKIES_BOT") {
    await tryStartFastingStyleBotGame(lobby.id, gameType);
  } else {
    await tryStartCastingBotGame(lobby.id);
  }

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
