import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBotAvatar } from "@/lib/botLooks";

/** Fixed pool: Bot_01 .. Bot_40. Run seed-bots or ensure these exist. */
const BOT_USERNAMES = Array.from({ length: 40 }, (_, i) => `Bot_${String(i + 1).padStart(2, "0")}`);

async function dressBot(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: randomBotAvatar(),
  });
}

/** Ensure a bot user exists with a random look. Returns userId. */
async function getOrCreateBot(uname: string): Promise<string> {
  const unameLower = uname.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { usernameLower: unameLower },
    select: {
      id: true,
      bodyStyle: true,
      hairStyle: true,
      shirtStyle: true,
      accessoryStyle: true,
      shirtColor: true,
      hairColor: true,
    },
  });
  if (existing) {
    // Re-roll looks that still look like the blank default.
    const looksDefault =
      existing.hairStyle === "hair_m_01" &&
      existing.shirtStyle === "shirt_01" &&
      existing.accessoryStyle === "none" &&
      existing.shirtColor === "#E53935" &&
      existing.hairColor === "#2B1B0E";
    if (looksDefault) await dressBot(existing.id);
    return existing.id;
  }

  const email = `${unameLower}@regaged.bot`;
  const passwordHash = await bcrypt.hash("bot123", 10);
  const look = randomBotAvatar();
  const u = await prisma.user.create({
    data: {
      username: uname,
      usernameLower: unameLower,
      passwordHash,
      email,
      emailVerifiedAt: new Date(),
      ...look,
    },
    select: { id: true },
  });
  return u.id;
}

/** Force a fresh random outfit on every bot in the pool (idempotent juice-up). */
export async function ensureBotsJuiced(): Promise<number> {
  let n = 0;
  for (const uname of BOT_USERNAMES) {
    const id = await getOrCreateBot(uname);
    await dressBot(id);
    n++;
  }
  return n;
}

/** Fill remaining slots by reusing the same bot pool. Returns count added. */
export async function fillGameWithBots(gameId: string, maxPlayers: number): Promise<number> {
  const current = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (current >= maxPlayers) return 0;

  const alreadyInGame = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: { userId: true },
  });
  const inGameSet = new Set(alreadyInGame.map((r) => r.userId));

  const botUserIds: string[] = [];
  for (const uname of BOT_USERNAMES) {
    const id = await getOrCreateBot(uname);
    if (!inGameSet.has(id)) botUserIds.push(id);
  }

  // Shuffle so different bots seat first each lobby.
  for (let i = botUserIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [botUserIds[i], botUserIds[j]] = [botUserIds[j]!, botUserIds[i]!];
  }

  const takenRows = await prisma.gamePlayer.findMany({
    where: { gameId, seatIndex: { not: null } },
    select: { seatIndex: true },
  });
  const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
  const open: number[] = [];
  for (let i = 1; i <= maxPlayers; i++) if (!taken.has(i)) open.push(i);

  let added = 0;
  for (const botId of botUserIds) {
    if (current + added >= maxPlayers) break;
    if (!open.length) break;
    const seat = open.splice(Math.floor(Math.random() * open.length), 1)[0];
    if (seat == null) break;
    try {
      // Fresh outfit each time they sit so lobbies look different.
      await dressBot(botId);
      await prisma.gamePlayer.create({
        data: { gameId, userId: botId, status: "ACTIVE", seatIndex: seat },
      });
      added++;
    } catch {
      break;
    }
  }
  return added;
}
