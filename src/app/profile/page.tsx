export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import ProfileTabs, { ProfileTabsData, ProfileGameBubble } from "@/components/ProfileTabs";
import Link from "next/link";
import type { AvatarConfig } from "@/components/Avatar";
import { getSlotDesignsForUser, getSlotDesignsForUserIds } from "@/lib/avatarSlotDesigns";
import { sortProfileGames } from "@/lib/sortProfileGames";

function oneOf(v: string, allowed: string[], fallback: string) {
  return allowed.includes(v) ? v : fallback;
}

export default async function ProfilePage({ searchParams }: { searchParams: { page?: string } }) {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-card)", padding: 14 }}>
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

  try {
  await touchUser(userId).catch((e) => console.error("Profile touchUser failed:", e));

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
  const u = user as typeof user & { glassesStyle?: string; scarStyle?: string; hairOrnamentStyle?: string; backgroundColor?: string; glassesColor?: string; scarColor?: string; hairOrnamentColor?: string };

  const slotDesigns = await getSlotDesignsForUser(userId);

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
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  const friendRows = await prisma.friendship.findMany({
    where: { userId },
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
  const friendIds = friendRows.map((r) => r.friend.id);
  const friendSlotDesigns = await getSlotDesignsForUserIds(friendIds);
  const mutualSet = new Set(
    friendIds.length > 0
      ? (
          await prisma.friendship.findMany({
            where: { friendId: userId, userId: { in: friendIds } },
            select: { userId: true },
          })
        ).map((m) => m.userId)
      : []
  );
  const friends = friendRows.map((f) => ({
    id: f.friend.id,
    username: f.friend.username,
    isMutual: mutualSet.has(f.friend.id),
    slotDesigns: friendSlotDesigns[f.friend.id] ?? {},
    avatar: {
      bodyStyle: oneOf(f.friend.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
      hairStyle: oneOf(f.friend.hairStyle, ["hair_m_01","hair_m_02","hair_m_03","hair_f_01","hair_f_02","hair_f_03"], "hair_m_01"),
      eyesStyle: oneOf(f.friend.eyesStyle, ["eyes_01","eyes_02","eyes_03","eyes_04","eyes_05","eyes_06"], "eyes_01"),
      mouthStyle: oneOf(f.friend.mouthStyle, ["mouth_01","mouth_02","mouth_03","mouth_04","mouth_05","mouth_06"], "mouth_01"),
      shirtStyle: oneOf(f.friend.shirtStyle, ["shirt_01","shirt_02","shirt_03","shirt_04","shirt_05","shirt_06"], "shirt_01"),
      accessoryStyle: oneOf(f.friend.accessoryStyle, ["none","accessory_01"], "none"),
      glassesStyle: "none",
      scarStyle: "none",
      hairOrnamentStyle: "none",
      bodyColor: f.friend.bodyColor,
      hairColor: f.friend.hairColor,
      eyeColor: f.friend.eyeColor,
      mouthColor: f.friend.mouthColor,
      shirtColor: f.friend.shirtColor,
      accessoryColor: f.friend.accessoryColor,
      backgroundColor: "#E8E8E8",
      glassesColor: "#111111",
      scarColor: "#8B4513",
      hairOrnamentColor: "#C0C0C0",
    },
  }));

  const avatar: AvatarConfig = {
    bodyStyle: oneOf(user.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(user.hairStyle, ["hair_m_01","hair_m_02","hair_m_03","hair_f_01","hair_f_02","hair_f_03"], "hair_m_01"),
    eyesStyle: oneOf(user.eyesStyle, ["eyes_01","eyes_02","eyes_03","eyes_04","eyes_05","eyes_06"], "eyes_01"),
    mouthStyle: oneOf(user.mouthStyle, ["mouth_01","mouth_02","mouth_03","mouth_04","mouth_05","mouth_06"], "mouth_01"),
    shirtStyle: oneOf(user.shirtStyle, ["shirt_01","shirt_02","shirt_03","shirt_04","shirt_05","shirt_06"], "shirt_01"),
    accessoryStyle: oneOf(user.accessoryStyle, ["none","accessory_01"], "none"),
    glassesStyle: oneOf(u.glassesStyle ?? "none", ["none"], "none"),
    scarStyle: oneOf(u.scarStyle ?? "none", ["none"], "none"),
    hairOrnamentStyle: oneOf(u.hairOrnamentStyle ?? "none", ["none"], "none"),

    bodyColor: user.bodyColor,
    hairColor: user.hairColor,
    eyeColor: user.eyeColor,
    mouthColor: user.mouthColor,
    shirtColor: user.shirtColor,
    accessoryColor: user.accessoryColor,
    backgroundColor: u.backgroundColor ?? "#E8E8E8",
    glassesColor: u.glassesColor ?? "#111111",
    scarColor: u.scarColor ?? "#8B4513",
    hairOrnamentColor: u.hairOrnamentColor ?? "#C0C0C0",
  };

  const data: ProfileTabsData = {
    isOwnProfile: true,
    username: user.username,
    joinedAt: (user.createdAt && typeof user.createdAt.toISOString === "function" ? user.createdAt.toISOString() : new Date().toISOString()),
    karma: user.karma,
    tMoney: user.tMoney,
    pMoney: user.pMoney,
    bio: user.bio ?? "", // ✅
    colorName: highestColor?.name ?? "White",
    colorAnimated: highestColor?.isAnimated ?? false,
    lastSeenAt: (user.lastSeenAt && typeof user.lastSeenAt.toISOString === "function" ? user.lastSeenAt.toISOString() : new Date().toISOString()),
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
  };

  return <ProfileTabs data={data} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Profile page error:", msg, stack);
    const showStack = typeof (searchParams as { page?: string; profile_debug?: string })?.profile_debug === "string";
    const safeMsg = String(msg).slice(0, 800);
    return (
      <main style={{ padding: 12 }}>
        <div className="theme-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p>We couldn’t load your profile. Try again or come back later.</p>
          {safeMsg && (
            <pre style={{ fontSize: 12, overflow: "auto", background: "var(--bg-muted)", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {safeMsg}
              {showStack && stack ? "\n\n" + stack : ""}
            </pre>
          )}
          <Link href="/">Back to home</Link>
        </div>
      </main>
    );
  }
}
