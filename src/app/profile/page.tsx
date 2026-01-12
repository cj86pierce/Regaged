export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import ProfileTabs, { ProfileTabsData, ProfileGameBubble } from "@/components/ProfileTabs";
import Link from "next/link";

export default async function ProfilePage({ searchParams }: { searchParams: { page?: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

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
      createdAt: true,
      lastSeenAt: true,

      bodyStyle: true, hairStyle: true, eyesStyle: true, mouthStyle: true, shirtStyle: true,
      bodyColor: true, hairColor: true, eyeColor: true, shirtColor: true,
    },
  });
  if (!user) throw new Error("User not found");

  const purchased = await prisma.userColor.findMany({ where: { userId }, include: { color: true } });
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

  const all: ProfileGameBubble[] = raw
    .map((r) => ({
      gameId: r.gameId,
      gameNumber: r.game.number,
      gameType: r.game.gameType,
      state: r.game.state,
      joinedAt: r.joinedAt.toISOString(),
      yourStatus: r.status,
      eliminatedPlace: r.eliminatedPlace ?? null,
    }))
    .sort((a, b) => {
      const aActive = a.state !== "COMPLETED" && a.yourStatus === "ACTIVE";
      const bActive = b.state !== "COMPLETED" && b.yourStatus === "ACTIVE";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const start = (page - 1) * pageSize;
  const recentGames = all.slice(start, start + pageSize);

  const data: ProfileTabsData = {
    isOwnProfile: true,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    tMoney: user.tMoney,
    colorName: highestColor?.name ?? "White",
    colorAnimated: highestColor?.isAnimated ?? false,
    lastSeenAt: user.lastSeenAt.toISOString(),

    avatar: {
      bodyStyle: user.bodyStyle,
      hairStyle: user.hairStyle,
      eyesStyle: user.eyesStyle,
      mouthStyle: user.mouthStyle,
      shirtStyle: user.shirtStyle,
      bodyColor: user.bodyColor,
      hairColor: user.hairColor,
      eyeColor: user.eyeColor,
      shirtColor: user.shirtColor,
    },

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
