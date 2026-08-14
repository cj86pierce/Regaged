import { prisma } from "@/lib/prisma";
import type { AvatarConfig } from "@/components/Avatar";
import type { ProfileGameBubble, ProfileTabsData } from "@/components/ProfileTabs";
import { getSlotDesignsForUser, getSlotDesignsForUserIds } from "@/lib/avatarSlotDesigns";
import { sortProfileGames } from "@/lib/sortProfileGames";
import { avatarConfigFromUser } from "@/lib/avatarConfigFromUser";
import { getKarmaRank } from "@/lib/hof";
import { resolveStaffFlags } from "@/lib/staffAccess";

const avatarSelect = {
  id: true,
  username: true,
  bodyStyle: true,
  hairStyle: true,
  eyesStyle: true,
  mouthStyle: true,
  shirtStyle: true,
  accessoryStyle: true,
  glassesStyle: true,
  scarStyle: true,
  hairOrnamentStyle: true,
  bodyColor: true,
  hairColor: true,
  eyeColor: true,
  mouthColor: true,
  shirtColor: true,
  accessoryColor: true,
  backgroundColor: true,
  glassesColor: true,
  scarColor: true,
  hairOrnamentColor: true,
} as const;

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "1 min" : `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return hrs === 1 ? "1 hour" : `${hrs} hours`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

function placeLabel(n: number | null): string {
  if (n == null) return "";
  const j = n % 10,
    k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export async function loadProfileTabsData(opts: {
  userId: string;
  isOwnProfile: boolean;
  page: number;
  viewerId?: string | null;
}): Promise<ProfileTabsData> {
  const { userId, isOwnProfile, page: pageIn, viewerId } = opts;
  const page = Math.max(1, pageIn || 1);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...avatarSelect,
      usernameLower: true,
      karma: true,
      tMoney: true,
      bio: true,
      isOwner: true,
      isAdmin: true,
      warnedAt: true,
      bannedAt: true,
      emailVerifiedAt: true,
      createdAt: true,
      lastSeenAt: true,
      equippedColor: { select: { name: true, karmaNeeded: true, isAnimated: true } },
    },
  });
  if (!user) throw new Error("User not found");

  const [
    slotDesigns,
    purchased,
    gpAgg,
    rawGames,
    blogPostsRaw,
    friendRows,
    betsRaw,
    myAuctionsRaw,
    designGiftsRaw,
    whiteColor,
  ] = await Promise.all([
    getSlotDesignsForUser(userId),
    prisma.userColor.findMany({
      where: { userId },
      include: { color: { select: { name: true, karmaNeeded: true, isAnimated: true } } },
      orderBy: { purchasedAt: "asc" },
    }),
    prisma.gamePlayer.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { chatCount: true, plusCount: true, minusCount: true, povWins: true },
    }),
    prisma.gamePlayer.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      take: 70,
      select: {
        gameId: true,
        status: true,
        eliminatedPlace: true,
        joinedAt: true,
        eliminatedAt: true,
        game: { select: { number: true, gameType: true, state: true, completedAt: true } },
      },
    }),
    prisma.blogPost.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.friendship.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { friend: { select: avatarSelect } },
    }),
    prisma.rookiesBet.findMany({
      where: { betterUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        gameId: true,
        targetUserId: true,
        amount: true,
        payoutAmount: true,
        paidOutAt: true,
        createdAt: true,
        game: { select: { number: true } },
      },
    }),
    prisma.auction.findMany({
      where: { design: { userId } },
      orderBy: [{ soldAt: "desc" }, { endsAt: "desc" }],
      take: 12,
      select: {
        id: true,
        designId: true,
        currentBid: true,
        soldAt: true,
        endsAt: true,
        design: { select: { title: true } },
      },
    }),
    prisma.designOwner.findMany({
      where: { userId },
      orderBy: { acquiredAt: "desc" },
      take: 60,
      select: {
        acquiredAt: true,
        design: { select: { id: true, title: true, designType: true } },
      },
    }),
    prisma.colorLevel.findUnique({ where: { id: 0 }, select: { name: true, isAnimated: true } }),
  ]);

  const highestColor =
    purchased.length > 0
      ? purchased.map((p) => p.color).sort((a, b) => b.karmaNeeded - a.karmaNeeded)[0]
      : whiteColor;
  const shownColor = user.equippedColor ?? highestColor;

  const allGames: ProfileGameBubble[] = sortProfileGames(
    rawGames.map((r) => ({
      gameId: r.gameId,
      gameNumber: r.game.number,
      gameType: r.game.gameType,
      state: r.game.state,
      joinedAt: r.joinedAt.toISOString(),
      yourStatus: r.status,
      eliminatedPlace: r.eliminatedPlace ?? null,
    }))
  );

  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(allGames.length / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;
  const recentGames = allGames.slice(start, start + pageSize);

  const friendIds = friendRows.map((r) => r.friend.id);
  const [friendSlotDesigns, mutualList] = await Promise.all([
    getSlotDesignsForUserIds(friendIds),
    friendIds.length > 0
      ? prisma.friendship.findMany({
          where: { friendId: userId, userId: { in: friendIds } },
          select: { userId: true },
        })
      : Promise.resolve([] as { userId: string }[]),
  ]);
  const mutualSet = new Set(mutualList.map((m) => m.userId));
  const friends = friendRows.map((f) => ({
    id: f.friend.id,
    username: f.friend.username,
    isMutual: mutualSet.has(f.friend.id),
    slotDesigns: friendSlotDesigns[f.friend.id] ?? {},
    avatar: avatarConfigFromUser(f.friend) as AvatarConfig,
  }));

  const betTargetIds = [...new Set(betsRaw.map((b) => b.targetUserId))];
  const betTargets = betTargetIds.length
    ? await prisma.user.findMany({
        where: { id: { in: betTargetIds } },
        select: { id: true, username: true },
      })
    : [];
  const betName = Object.fromEntries(betTargets.map((u) => [u.id, u.username]));

  const bets = betsRaw.map((b) => ({
    id: b.id,
    gameId: b.gameId,
    gameNumber: b.game.number,
    amount: b.amount,
    payoutAmount: b.payoutAmount,
    paidOutAt: b.paidOutAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    targetUsername: betName[b.targetUserId] ?? "?",
  }));

  const myAuctions = myAuctionsRaw.map((a) => ({
    id: a.id,
    auctionId: a.id,
    designId: a.designId,
    designTitle: a.design.title,
    soldPrice: a.currentBid,
    soldAt: a.soldAt?.toISOString() ?? null,
    endsAt: a.endsAt.toISOString(),
  }));

  const designGifts = designGiftsRaw.map((o) => ({
    id: o.design.id,
    title: o.design.title,
    designType: o.design.designType,
    acquiredAt: o.acquiredAt.toISOString(),
  }));

  const colorHistory = purchased.map((p) => ({
    name: p.color.name,
    purchasedAt: p.purchasedAt.toISOString(),
  }));

  const blogPosts = blogPostsRaw.map((b) => ({
    id: b.id,
    title: b.title,
    createdAt: b.createdAt.toISOString(),
  }));

  type Action = { id: string; label: string; href?: string; at: string };
  const actions: Action[] = [];

  for (const g of rawGames.slice(0, 25)) {
    const type = g.game.gameType.replace(/_/g, " ").toLowerCase();
    if (g.game.state === "COMPLETED" || g.status === "ELIMINATED") {
      const place = placeLabel(g.eliminatedPlace);
      actions.push({
        id: `game-end-${g.gameId}`,
        label: `${user.username} finished ${type} #${g.game.number}${place ? ` — ${place}` : ""}`,
        href: `/game/${g.gameId}`,
        at: (g.eliminatedAt ?? g.game.completedAt ?? g.joinedAt).toISOString(),
      });
    } else {
      actions.push({
        id: `game-join-${g.gameId}`,
        label: `${user.username} joined ${type} #${g.game.number}`,
        href: `/game/${g.gameId}`,
        at: g.joinedAt.toISOString(),
      });
    }
  }
  for (const b of blogPostsRaw.slice(0, 15)) {
    actions.push({
      id: `blog-${b.id}`,
      label: `${user.username} posted “${b.title}”`,
      href: `/blogs/${b.id}`,
      at: b.createdAt.toISOString(),
    });
  }
  for (const p of purchased.slice().reverse().slice(0, 10)) {
    actions.push({
      id: `color-${p.colorId}-${p.purchasedAt.toISOString()}`,
      label: `${user.username} unlocked ${p.color.name}`,
      href: "/shop/colors",
      at: p.purchasedAt.toISOString(),
    });
  }
  for (const b of betsRaw.slice(0, 12)) {
    const won = b.paidOutAt && (b.payoutAmount ?? 0) > 0;
    actions.push({
      id: `bet-${b.id}`,
      label: won
        ? `${user.username} won ${b.payoutAmount} R$ betting on ${betName[b.targetUserId] ?? "?"} in game #${b.game.number}`
        : `${user.username} bet ${b.amount} R$ on ${betName[b.targetUserId] ?? "?"} in game #${b.game.number}`,
      href: `/game/${b.gameId}`,
      at: (b.paidOutAt ?? b.createdAt).toISOString(),
    });
  }

  actions.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const latestActions = actions.slice(0, 20).map((a) => ({
    ...a,
    ago: relativeAgo(a.at),
  }));

  let isFriend = false;
  let canAddFriend = false;
  if (!isOwnProfile && viewerId) {
    const row = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: viewerId, friendId: userId } },
      select: { id: true },
    });
    isFriend = !!row;
    canAddFriend = viewerId !== userId && !isFriend;
  }

  const hofRank = await getKarmaRank(userId);
  const staff = resolveStaffFlags(user);

  return {
    isOwnProfile,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    hofRank,
    isOwner: staff.isOwner,
    isAdmin: staff.isAdmin,
    isWarned: !!user.warnedAt,
    isBanned: !!user.bannedAt,
    emailVerified: isOwnProfile ? !!user.emailVerifiedAt : undefined,
    tMoney: user.tMoney,
    bio: user.bio ?? "",
    colorName: shownColor?.name ?? "White",
    colorAnimated: shownColor?.isAnimated ?? false,
    lastSeenAt: user.lastSeenAt.toISOString(),
    avatar: avatarConfigFromUser(user),
    slotDesigns,
    stats: {
      gamesPlayed: gpAgg._count._all ?? 0,
      totalChats: gpAgg._sum.chatCount ?? 0,
      totalPlus: gpAgg._sum.plusCount ?? 0,
      totalMinus: gpAgg._sum.minusCount ?? 0,
      totalPov: gpAgg._sum.povWins ?? 0,
    },
    recentGames,
    recentGamesPage: Math.min(page, totalPages),
    recentGamesTotalPages: totalPages,
    blogPosts,
    friends,
    isFriend: isOwnProfile ? undefined : isFriend,
    canAddFriend: isOwnProfile ? undefined : canAddFriend,
    showSocialActions: !isOwnProfile && !!viewerId,
    profileUserId: userId,
    colorHistory,
    bets,
    myAuctions,
    designGifts,
    latestActions,
  };
}
