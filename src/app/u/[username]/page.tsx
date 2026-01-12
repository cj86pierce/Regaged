import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProfileTabs, { ProfileTabsData } from "@/components/ProfileTabs";

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const username = decodeURIComponent(params.username).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, karma: true, tMoney: true, createdAt: true },
  });

  if (!user) {
    return (
      <main style={{ padding: 8 }}>
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            padding: 14,
          }}
        >
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

  const gamesPlayed = gpAgg._count._all ?? 0;

  const recent = await prisma.gamePlayer.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    take: 12,
    select: {
      gameId: true,
      status: true,
      eliminatedAt: true,
      game: {
        select: {
          gameType: true,
          state: true,
          roundNumber: true,
          startsAt: true,
          completedAt: true,
        },
      },
    },
  });

  const data: ProfileTabsData = {
    isOwnProfile: false,
    username: user.username,
    joinedAt: user.createdAt.toISOString(),
    karma: user.karma,
    tMoney: user.tMoney,
    colorName: highestColor?.name ?? "White",
    colorAnimated: highestColor?.isAnimated ?? false,
    stats: {
      gamesPlayed,
      totalChats: gpAgg._sum.chatCount ?? 0,
      totalPlus: gpAgg._sum.plusCount ?? 0,
      totalMinus: gpAgg._sum.minusCount ?? 0,
      totalPov: gpAgg._sum.povWins ?? 0,
    },
    recentGames: recent.map((r) => ({
      gameId: r.gameId,
      gameType: r.game.gameType,
      state: r.game.state,
      roundNumber: r.game.roundNumber,
      startedAt: r.game.startsAt ? r.game.startsAt.toISOString() : null,
      completedAt: r.game.completedAt ? r.game.completedAt.toISOString() : null,
      yourStatus: r.status,
      eliminatedAt: r.eliminatedAt ? r.eliminatedAt.toISOString() : null,
    })),
  };

  return <ProfileTabs data={data} />;
}
