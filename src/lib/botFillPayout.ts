import { prisma } from "@/lib/prisma";

const MAX_BOT_FILL_PAYOUT_GAMES_PER_DAY = 3;

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBotAccount(email: string | null | undefined, usernameLower: string): boolean {
  return !!email?.endsWith("@regaged.bot") || usernameLower.startsWith("bot_");
}

/** Whether this live game was padded with bots (or still has bot seats — legacy fallback). */
export async function isGameBotFilled(gameId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { botFilled: true },
  });
  if (game?.botFilled) return true;

  const botSeat = await prisma.gamePlayer.findFirst({
    where: {
      gameId,
      user: {
        OR: [{ email: { endsWith: "@regaged.bot" } }, { usernameLower: { startsWith: "bot_" } }],
      },
    },
    select: { userId: true },
  });
  return !!botSeat;
}

/**
 * Grant placement karma/R$. For bot-filled live games:
 * - at most 1 karma payout per UTC day
 * - at most 3 payout games per UTC day (R$ on those; nothing after the 3rd)
 * Full-human live games are uncapped. Practice *_BOT types should skip calling this.
 */
export async function applyPlacementPayout(
  userId: string,
  karma: number,
  tMoney: number,
  opts: { botFilled: boolean }
): Promise<{ karma: number; tMoney: number }> {
  const wantKarma = Math.max(0, Math.floor(karma));
  const wantT = Math.max(0, Math.floor(tMoney));
  if (wantKarma <= 0 && wantT <= 0) return { karma: 0, tMoney: 0 };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      usernameLower: true,
      botFillPayoutGamesToday: true,
      botFillKarmaPaidToday: true,
      botFillPayoutResetDate: true,
    },
  });
  if (!user) return { karma: 0, tMoney: 0 };

  // System bots never receive currency.
  if (isBotAccount(user.email, user.usernameLower)) {
    return { karma: 0, tMoney: 0 };
  }

  if (!opts.botFilled) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(wantKarma > 0 ? { karma: { increment: wantKarma } } : {}),
        ...(wantT > 0 ? { tMoney: { increment: wantT } } : {}),
      },
    });
    return { karma: wantKarma, tMoney: wantT };
  }

  const today = utcToday();
  let gamesToday = user.botFillPayoutGamesToday ?? 0;
  let karmaPaid = user.botFillKarmaPaidToday ?? false;
  if (user.botFillPayoutResetDate !== today) {
    gamesToday = 0;
    karmaPaid = false;
  }

  if (gamesToday >= MAX_BOT_FILL_PAYOUT_GAMES_PER_DAY) {
    return { karma: 0, tMoney: 0 };
  }

  const payKarma = karmaPaid ? 0 : wantKarma;
  const payT = wantT;

  await prisma.user.update({
    where: { id: userId },
    data: {
      botFillPayoutResetDate: today,
      botFillPayoutGamesToday: gamesToday + 1,
      botFillKarmaPaidToday: karmaPaid || payKarma > 0,
      ...(payKarma > 0 ? { karma: { increment: payKarma } } : {}),
      ...(payT > 0 ? { tMoney: { increment: payT } } : {}),
    },
  });

  return { karma: payKarma, tMoney: payT };
}
