import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/** Fixed pool: Bot_01 .. Bot_40. Run seed-bots or ensure these exist. */
const BOT_USERNAMES = Array.from({ length: 40 }, (_, i) => `Bot_${String(i + 1).padStart(2, "0")}`);

/** Ensure a bot user exists. Create if not. Returns userId. */
async function getOrCreateBot(uname: string): Promise<string> {
  const unameLower = uname.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { usernameLower: unameLower },
    select: { id: true },
  });
  if (existing) return existing.id;

  const email = `${unameLower}@regaged.bot`;
  const passwordHash = await bcrypt.hash("bot123", 10);
  const u = await prisma.user.create({
    data: {
      username: uname,
      usernameLower: unameLower,
      passwordHash,
      email,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return u.id;
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
