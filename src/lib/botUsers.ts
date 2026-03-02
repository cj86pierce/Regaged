import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function randStr(n = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Create a bot user and return its id */
export async function createBotUser(): Promise<string> {
  const uname = `bot_${randStr(7)}`;
  const unameLower = uname.toLowerCase();
  const email = `${unameLower}@regaged.local`;
  const passwordHash = await bcrypt.hash("bot-password", 4);

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

/** Fill remaining slots in a game with bot users. Returns count of bots added. */
export async function fillGameWithBots(gameId: string, maxPlayers: number): Promise<number> {
  const current = await prisma.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
  if (current >= maxPlayers) return 0;

  let added = 0;
  while (current + added < maxPlayers) {
    const botId = await createBotUser();
    const takenRows = await prisma.gamePlayer.findMany({
      where: { gameId, seatIndex: { not: null } },
      select: { seatIndex: true },
    });
    const taken = new Set(takenRows.map((r) => r.seatIndex!).filter(Boolean));
    const open: number[] = [];
    for (let i = 1; i <= maxPlayers; i++) if (!taken.has(i)) open.push(i);
    const seat = open.length ? open[Math.floor(Math.random() * open.length)] : null;

    await prisma.gamePlayer.create({
      data: { gameId, userId: botId, status: "ACTIVE", ...(seat ? { seatIndex: seat } : {}) },
    });
    added++;
  }
  return added;
}
