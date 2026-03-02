export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import ProfileTabs, { ProfileTabsData, ProfileGameBubble } from "@/components/ProfileTabs";
import Link from "next/link";
import type { AvatarConfig } from "@/components/Avatar";

function oneOf(v: string, allowed: string[], fallback: string) {
  return allowed.includes(v) ? v : fallback;
}

export default async function ProfilePage({ searchParams }: { searchParams: { page?: string } }) {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, background: "#fff", padding: 14 }}>
          <h1 style={{ marginTop: 0 }}>Profile</h1>
          <p>You’re not logged in.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </div>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      karma: true,
      tMoney: true,
      pMoney: true,
      bio: true, // ✅

      createdAt: true,
      lastSeenAt: true,

      bodyStyle: true,
      hairStyle: true,
      eyesStyle: true,
      mouthStyle: true,
      shirtStyle: true,
      accessoryStyle: true,

      bodyColor: true,
      hairColor: true,
      eyeColor: true,
      mouthColor: true,
      shirtColor: true,
      accessoryColor: true,
    },
  });
  if (!user) throw new Error("User not found");

  const purchased = await prisma.userColor.findMany({
    where: { userId },
    include: { color: true },
  });
  const highestColor =
    purchased.length > 0
      ? purchased.map((p) => p.color).sort((a, b) => b.karmaNeeded - a.karmaNeeded)[0]
      : await prisma.colorLevel.findUnique({ where: { id: 0 } });

  const gpAgg = await prisma.gamePlayer.aggregate({
    where: { userId },
    _count: { _all: true },
    _sum: { chatCount: true, plusCount: true, minusCount: true, povWins: true },
  });

  const raw = await prisma.gamePlayer.findMany({
    where: { userId },
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

  const all: ProfileGameBubble[] = raw.map((r) => ({
    gameId: r.gameId,
    gameNumber: r.game.number,
    gameType: r.game.gameType,
    state: r.game.state,
    joinedAt: r.joinedAt.toISOString(),
    yourStatus: r.status,
    eliminatedPlace: r.eliminatedPlace ?? null,
  }));

  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const start = (page - 1) * pageSize;
  const recentGames = all.slice(start, start + pageSize);

  const blogPosts = await prisma.blogPost.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  const friendRows = await prisma.friendship.findMany({
    where: { userId },
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
          bodyColor: true,
          hairColor: true,
          eyeColor: true,
          mouthColor: true,
          shirtColor: true,
          accessoryColor: true,
        },
      },
    },
  });
  const friends = friendRows.map((f) => ({
    id: f.friend.id,
    username: f.friend.username,
    avatar: {
      bodyStyle: oneOf(f.friend.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
      hairStyle: oneOf(f.friend.hairStyle, ["hair_m_01","hair_m_02","hair_m_03","hair_f_01","hair_f_02","hair_f_03"], "hair_m_01"),
      eyesStyle: oneOf(f.friend.eyesStyle, ["eyes_01","eyes_02","eyes_03","eyes_04","eyes_05","eyes_06"], "eyes_01"),
      mouthStyle: oneOf(f.friend.mouthStyle, ["mouth_01","mouth_02","mouth_03","mouth_04","mouth_05","mouth_06"], "mouth_01"),
      shirtStyle: oneOf(f.friend.shirtStyle, ["shirt_01","shirt_02","shirt_03","shirt_04","shirt_05","shirt_06"], "shirt_01"),
      accessoryStyle: oneOf(f.friend.accessoryStyle, ["none","accessory_01"], "none"),
      bodyColor: f.friend.bodyColor,
      hairColor: f.friend.hairColor,
      eyeColor: f.friend.eyeColor,
      mouthColor: f.friend.mouthColor,
      shirtColor: f.friend.shirtColor,
      accessoryColor: f.friend.accessoryColor,
    },
  }));

  const avatar: AvatarConfig = {
    bodyStyle: oneOf(user.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(user.hairStyle, ["hair_m_01","hair_m_02","hair_m_03","hair_f_01","hair_f_02","hair_f_03"], "hair_m_01"),
    eyesStyle: oneOf(user.eyesStyle, ["eyes_01","eyes_02","eyes_03","eyes_04","eyes_05","eyes_06"], "eyes_01"),
    mouthStyle: oneOf(user.mouthStyle, ["mouth_01","mouth_02","mouth_03","mouth_04","mouth_05","mouth_06"], "mouth_01"),
    shirtStyle: oneOf(user.shirtStyle, ["shirt_01","shirt_02","shirt_03","shirt_04","shirt_05","shirt_06"], "shirt_01"),
    accessoryStyle: oneOf(user.accessoryStyle, ["none","accessory_01"], "none"),

    bodyColor: user.bodyColor,
    hairColor: user.hairColor,
    eyeColor: user.eyeColor,
    mouthColor: user.mouthColor,
    shirtColor: user.shirtColor,
    accessoryColor: user.accessoryColor,
  };

  const data: ProfileTabsData = {
    isOwnProfile: true,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    tMoney: user.tMoney,
    pMoney: user.pMoney,
    bio: user.bio ?? "", // ✅
    colorName: highestColor?.name ?? "White",
    colorAnimated: highestColor?.isAnimated ?? false,
    lastSeenAt: user.lastSeenAt.toISOString(),
    avatar,
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
  };

  return <ProfileTabs data={data} />;
}
