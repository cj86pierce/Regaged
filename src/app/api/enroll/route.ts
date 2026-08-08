import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isEmailVerified } from "@/lib/emailVerification";
import { maybeFillAndStartBotLobby, maybeStartLiveLobby } from "@/lib/lobbyTiming";
import { SURVIVOR_MAX, SURVIVOR_MERGE_MAX } from "@/lib/survivor/timing";

const FASTING_MAX = 15;
const CASTING_MAX = 20;

type GameType =
  | "FASTING"
  | "CASTING"
  | "FASTING_BOT"
  | "CASTING_BOT"
  | "FROOKIES"
  | "ROOKIES"
  | "FROOKIES_BOT"
  | "ROOKIES_BOT"
  | "SURVIVOR"
  | "SURVIVOR_BOT";

const ALL_TYPES: GameType[] = [
  "FASTING",
  "CASTING",
  "FASTING_BOT",
  "CASTING_BOT",
  "FROOKIES",
  "ROOKIES",
  "FROOKIES_BOT",
  "ROOKIES_BOT",
  "SURVIVOR",
  "SURVIVOR_BOT",
];

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

  if (!ALL_TYPES.includes(gameType)) {
    return NextResponse.json({ error: "Invalid gameType" }, { status: 400 });
  }

  // FROOKIES / SURVIVOR: Yellow + T$10
  if (gameType === "FROOKIES" || gameType === "SURVIVOR") {
    const yellow = await prisma.colorLevel.findUnique({ where: { name: "Yellow" }, select: { id: true } });
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { tMoney: true, equippedColorId: true },
    });
    if (!yellow || me?.equippedColorId !== yellow.id) {
      return NextResponse.json(
        {
          error:
            gameType === "SURVIVOR"
              ? "Yellow card required. Equip Yellow in Shop → Colors to play Survivor."
              : "Yellow card required. Equip Yellow in Shop → Colors to play Frookies.",
        },
        { status: 403 }
      );
    }
    if ((me?.tMoney ?? 0) < 10) {
      return NextResponse.json(
        { error: "Entrance fee is T$10. You need more T$ to join." },
        { status: 403 }
      );
    }
  }

  // ROOKIES: Yellow + T$15
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

  const isSurvivor = gameType === "SURVIVOR" || gameType === "SURVIVOR_BOT";

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

  // Public enroll joins tribal Survivor only (merge lobbies are auto-filled from tribe stage).
  let lobby = await prisma.game.findFirst({
    where: {
      gameType,
      state: "ENROLLING",
      ...(isSurvivor ? { survivorIsMerge: false } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, survivorIsMerge: true },
  });

  if (!lobby) {
    lobby = await prisma.game.create({
      data: {
        gameType,
        state: "ENROLLING",
        roundNumber: 0,
        ...(isSurvivor ? { survivorIsMerge: false } : {}),
      },
      select: { id: true, survivorIsMerge: true },
    });
  }

  const MAX =
    gameType === "CASTING" || gameType === "CASTING_BOT"
      ? CASTING_MAX
      : isSurvivor
        ? lobby.survivorIsMerge
          ? SURVIVOR_MERGE_MAX
          : SURVIVOR_MAX
        : FASTING_MAX;

  const isBotMode =
    gameType === "FASTING_BOT" ||
    gameType === "CASTING_BOT" ||
    gameType === "FROOKIES_BOT" ||
    gameType === "ROOKIES_BOT" ||
    gameType === "SURVIVOR_BOT";

  const existing = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId: lobby.id, userId } },
    select: { id: true },
  });

  if (!existing) {
    const activeCount = await prisma.gamePlayer.count({
      where: { gameId: lobby.id, status: "ACTIVE" },
    });
    if (activeCount >= MAX) {
      return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
    }

    if (gameType === "FROOKIES" || gameType === "SURVIVOR") {
      const updated = await prisma.user.updateMany({
        where: { id: userId, tMoney: { gte: 10 } },
        data: { tMoney: { decrement: 10 } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "Not enough T$. Entrance fee is T$10." }, { status: 403 });
      }
    }
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

    // Never create seatless overflow players (this caused 21 in Survivor).
    if (!open.length) {
      if (gameType === "FROOKIES" || gameType === "SURVIVOR") {
        await prisma.user.update({
          where: { id: userId },
          data: { tMoney: { increment: 10 } },
        });
      }
      if (gameType === "ROOKIES") {
        await prisma.user.update({
          where: { id: userId },
          data: { tMoney: { increment: 15 } },
        });
      }
      return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
    }

    const seat = open[Math.floor(Math.random() * open.length)];

    try {
      await prisma.gamePlayer.create({
        data: { gameId: lobby.id, userId, status: "ACTIVE", seatIndex: seat },
      });
    } catch {
      if (gameType === "FROOKIES" || gameType === "SURVIVOR") {
        await prisma.user.update({
          where: { id: userId },
          data: { tMoney: { increment: 10 } },
        });
      }
      if (gameType === "ROOKIES") {
        await prisma.user.update({
          where: { id: userId },
          data: { tMoney: { increment: 15 } },
        });
      }
      return NextResponse.json({ error: "Lobby is full." }, { status: 409 });
    }
  }

  // Practice *_BOT: fill + start immediately.
  // Live modes: start if full now; otherwise wait 15m then bot-fill empty seats.
  if (isBotMode) {
    await maybeFillAndStartBotLobby(lobby.id);
  } else {
    await maybeStartLiveLobby(lobby.id);
  }

  return NextResponse.json({ ok: true, gameId: lobby.id });
}
