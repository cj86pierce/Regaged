export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import ProfileTabs, { ProfileTabsData, ProfileGameBubble } from "@/components/ProfileTabs";
import Link from "next/link";
import type { AvatarConfig } from "@/components/Avatar";
import { getSlotDesignsForUser, getSlotDesignsForUserIds } from "@/lib/avatarSlotDesigns";
import { sortProfileGames } from "@/lib/sortProfileGames";
import { avatarConfigFromUser } from "@/lib/avatarConfigFromUser";
import { getKarmaRank } from "@/lib/hof";
import { isOwnerUsername } from "@/lib/usernames";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { page?: string };
}) {
  const usernameLower = decodeURIComponent(params.username).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { usernameLower },
    select: {
      id: true,
      username: true,
      usernameLower: true,
      karma: true,
      tMoney: true,
      bio: true,
      isOwner: true,
      warnedAt: true,
      bannedAt: true,
      createdAt: true,
      lastSeenAt: true,

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
    },
  });

  if (!user) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-card)", padding: 14 }}>
          <h1 style={{ marginTop: 0 }}>Profile</h1>
          <p>User not found.</p>
          <Link href="/">Back to home</Link>
        </div>
      </main>
    );
  }

  const currentUserId = await getCurrentUserIdFromHeaders();
  if (currentUserId === user.id) {
    await touchUser(currentUserId);
  }

  const purchased = await prisma.userColor.findMany({
    where: { userId: user.id },
    include: { color: true },
  });

  const highestColor =
    purchased.length > 0
      ? purchased.map((p) => p.color).sort((a, b) => b.karmaNeeded - a.karmaNeeded)[0]
      : await prisma.colorLevel.findUnique({ where: { id: 0 } });

  const gpAgg = await prisma.gamePlayer.aggregate({
    where: { userId: user.id },
    _count: { _all: true },
    _sum: { chatCount: true, plusCount: true, minusCount: true, povWins: true },
  });

  const raw = await prisma.gamePlayer.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    take: 70,
    select: {
      gameId: true,
      status: true,
      eliminatedPlace: true,
      joinedAt: true,
      game: { select: { number: true, gameType: true, state: true } },
    },
  });

  const all: ProfileGameBubble[] = sortProfileGames(
    raw.map((r) => ({
      gameId: r.gameId,
      gameNumber: r.game.number,
      gameType: r.game.gameType,
      state: r.game.state,
      joinedAt: r.joinedAt.toISOString(),
      yourStatus: r.status,
      eliminatedPlace: r.eliminatedPlace ?? null,
    }))
  );

  const pageSize = 6;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const start = (page - 1) * pageSize;
  const recentGames = all.slice(start, start + pageSize);

  const blogPosts = await prisma.blogPost.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  const friendRows = await prisma.friendship.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    include: {
      friend: {
        select: {
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
        },
      },
    },
  });
  const friendIds = friendRows.map((r) => r.friend.id);
  const [friendSlotDesigns, mutualList] = await Promise.all([
    getSlotDesignsForUserIds(friendIds),
    friendIds.length > 0
      ? prisma.friendship.findMany({
          where: { friendId: user.id, userId: { in: friendIds } },
          select: { userId: true },
        })
      : Promise.resolve([]),
  ]);
  const mutualSet = new Set(mutualList.map((m) => m.userId));
  const friends = friendRows.map((f) => ({
    id: f.friend.id,
    username: f.friend.username,
    isMutual: mutualSet.has(f.friend.id),
    slotDesigns: friendSlotDesigns[f.friend.id] ?? {},
    avatar: avatarConfigFromUser(f.friend),
  }));

  const isFriend = currentUserId
    ? (await prisma.friendship.findUnique({
        where: { userId_friendId: { userId: currentUserId, friendId: user.id } },
      })) !== null
    : false;
  const canAddFriend = !!currentUserId && currentUserId !== user.id && !isFriend;

  const avatar: AvatarConfig = avatarConfigFromUser(user);

  const slotDesigns = await getSlotDesignsForUser(user.id);

  const hofRank = await getKarmaRank(user.id);

  const data: ProfileTabsData = {
    isOwnProfile: false,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    hofRank,
    isOwner: user.isOwner || isOwnerUsername(user.usernameLower),
    isWarned: !!user.warnedAt,
    isBanned: !!user.bannedAt,
    tMoney: user.tMoney,
    bio: user.bio ?? "",
    colorName: highestColor?.name ?? "White",
    colorAnimated: highestColor?.isAnimated ?? false,
    lastSeenAt: user.lastSeenAt.toISOString(),
    avatar,
    slotDesigns,
    stats: {
      gamesPlayed: gpAgg._count._all ?? 0,
      totalChats: gpAgg._sum.chatCount ?? 0,
      totalPlus: gpAgg._sum.plusCount ?? 0,
      totalMinus: gpAgg._sum.minusCount ?? 0,
      totalPov: gpAgg._sum.povWins ?? 0,
    },
    recentGames,
    recentGamesPage: page,
    recentGamesTotalPages: totalPages,
    blogPosts,
    friends,
    isFriend,
    canAddFriend,
    profileUserId: user.id,
  };

  return <ProfileTabs data={data} />;
}
