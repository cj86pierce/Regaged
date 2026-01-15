export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import ProfileTabs, { ProfileTabsData, ProfileGameBubble } from "@/components/ProfileTabs";
import Link from "next/link";
import type { AvatarConfig } from "@/components/Avatar";

function oneOf(v: string, allowed: string[], fallback: string) {
  return allowed.includes(v) ? v : fallback;
}

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

  if (!user) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, background: "#fff", padding: 14 }}>
          <h1 style={{ marginTop: 0 }}>Profile</h1>
          <p>User not found.</p>
          <Link href="/">Back to home</Link>
        </div>
      </main>
    );
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
    isOwnProfile: false,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    tMoney: user.tMoney,
    bio: user.bio ?? "",
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
  };

  return <ProfileTabs data={data} />;
}
