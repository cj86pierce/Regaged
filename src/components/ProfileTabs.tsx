"use client";

import Link from "next/link";
import { useMemo } from "react";
import Avatar, { AvatarConfig } from "@/components/Avatar";

export type ProfileGameBubble = {
  gameId: string;
  gameNumber: number;
  gameType: string;
  state: string;
  joinedAt: string;
  yourStatus: "ACTIVE" | "ELIMINATED";
  eliminatedPlace: number | null;
};

export type ProfileTabsData = {
  isOwnProfile: boolean;
  username: string;
  joinedAt: string;
  karma: number;
  tMoney: number;
  colorName: string;
  colorAnimated: boolean;
  lastSeenAt: string;

  avatar: AvatarConfig;

  stats: {
    gamesPlayed: number;
    totalChats: number;
    totalPlus: number;
    totalMinus: number;
    totalPov: number;
  };

  recentGames: ProfileGameBubble[];
  recentGamesPage: number;
  recentGamesTotalPages: number;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 1000 }}>
        {title}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "#fff",
        fontWeight: 1000,
        fontSize: 12,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function suffix(n: number) {
  const j = n % 10,
    k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function onlineLabel(lastSeenAtIso: string) {
  const ms = Date.now() - new Date(lastSeenAtIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins <= 2) return { text: "online", style: { background: "#d1e7dd" as const } };
  if (mins <= 60) return { text: `${mins} min`, style: { background: "#fff3cd" as const } };
  return { text: "offline", style: { background: "#f8d7da" as const } };
}

// Rough swatches (you can tune later). Fallback is white.
const COLOR_SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#ffeb3b",
  orange: "#ff9800",
  "light green": "#8bc34a",
  green: "#2e7d32",
  blue: "#1e88e5",
  purple: "#8e24aa",
  red: "#e53935",
  brown: "#6d4c41",
  black: "#111111",
  silver: "#c0c0c0",
  gold: "#ffd700",
  sky: "#4fc3f7",
  blood: "#8b0000",
  "tv star": "#ff66cc",
};

function colorToSwatch(name: string) {
  const key = name.trim().toLowerCase();
  return COLOR_SWATCH[key] ?? "#ffffff";
}

function Bubble({ g }: { g: ProfileGameBubble }) {
  const isActiveGame = g.state !== "COMPLETED" && g.yourStatus === "ACTIVE";
  const isFilling = g.state === "ENROLLING" && g.yourStatus === "ACTIVE";

  const labelTop = g.gameType.toLowerCase();
  const labelBottom = isActiveGame ? (isFilling ? "filling" : "enter") : g.eliminatedPlace ? suffix(g.eliminatedPlace) : "—";

  return (
    <div style={{ textAlign: "center", width: 92 }}>
      <Link href={`/game/${g.gameId}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            border: "2px solid rgba(0,0,0,0.25)",
            background: isActiveGame ? "linear-gradient(#eaf2ff, #d6e6ff)" : "linear-gradient(#f3f6f9, #fff)",
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            fontWeight: 1000,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.95, textTransform: "uppercase" }}>{labelTop}</div>
          <div
            style={{
              position: "absolute",
              bottom: -9,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 1000,
              border: "1px solid rgba(0,0,0,0.20)",
              background: isActiveGame ? "#111" : "#fff",
              color: isActiveGame ? "#fff" : "#111",
              minWidth: 56,
              textAlign: "center",
            }}
          >
            {labelBottom}
          </div>
        </div>
      </Link>

      <div style={{ marginTop: 14, fontSize: 11, opacity: 0.75 }}>#{g.gameNumber}</div>
    </div>
  );
}

export default function ProfileTabs({ data }: { data: ProfileTabsData }) {
  const joinedLabel = useMemo(() => new Date(data.joinedAt).toLocaleDateString(), [data.joinedAt]);
  const presence = useMemo(() => onlineLabel(data.lastSeenAt), [data.lastSeenAt]);

  const swatch = colorToSwatch(data.colorName);

  return (
    <main style={{ padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        {/* LEFT */}
        <Card title="Profile">
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", placeItems: "start" }}>
              <Avatar config={data.avatar} width={200} />
            </div>

            <div>
              <div style={{ fontSize: 28, fontWeight: 1000, letterSpacing: -0.4, lineHeight: 1.05 }}>
                {data.username}
              </div>

              {/* ✅ light bar under name, swatch at end */}
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "#f3f6f9",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Pill>Karma: {data.karma}</Pill>
                  {data.isOwnProfile && <Pill>Money: {data.tMoney} T$</Pill>}
                  <Pill>Played: {data.stats.gamesPlayed}</Pill>
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.10)",
                      fontWeight: 1000,
                      fontSize: 12,
                      ...presence.style,
                    }}
                  >
                    {presence.text}
                  </span>
                </div>

                {/* ✅ color level swatch only */}
                <div
                  title={data.colorName}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: swatch,
                    border: "1px solid rgba(0,0,0,0.85)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    flex: "0 0 auto",
                  }}
                />
              </div>

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Joined {joinedLabel}</div>
            </div>
          </div>

          {/* ✅ Recent Games always visible */}
          <div style={{ marginTop: 14 }}>
            <Card title="Recent Games">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                {data.recentGames.map((g) => (
                  <Bubble key={g.gameId} g={g} />
                ))}
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Page <b>{data.recentGamesPage}</b> / {data.recentGamesTotalPages}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={data.recentGamesPage <= 1 ? "#" : `?page=${data.recentGamesPage - 1}`}
                    style={{
                      pointerEvents: data.recentGamesPage <= 1 ? "none" : "auto",
                      opacity: data.recentGamesPage <= 1 ? 0.4 : 1,
                      textDecoration: "none",
                      fontWeight: 1000,
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "#f3f6f9",
                      color: "#111",
                    }}
                  >
                    ◀ Prev
                  </Link>

                  <Link
                    href={data.recentGamesPage >= data.recentGamesTotalPages ? "#" : `?page=${data.recentGamesPage + 1}`}
                    style={{
                      pointerEvents: data.recentGamesPage >= data.recentGamesTotalPages ? "none" : "auto",
                      opacity: data.recentGamesPage >= data.recentGamesTotalPages ? 0.4 : 1,
                      textDecoration: "none",
                      fontWeight: 1000,
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "#f3f6f9",
                      color: "#111",
                    }}
                  >
                    Next ▶
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </Card>

        {/* RIGHT */}
        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Participate!">
            <div style={{ display: "grid", gap: 10 }}>
              <Link
                href="/enroll"
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 1000,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "linear-gradient(#ffd85a, #ffb703)",
                  color: "#3a2b00",
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 8px 18px rgba(255, 183, 3, 0.25)",
                }}
              >
                Enroll now ▶
              </Link>

              {data.isOwnProfile && (
                <Link
                  href="/profile/avatar"
                  style={{
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                    fontWeight: 1000,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "linear-gradient(#eaf2ff, #d6e6ff)",
                    color: "#0b2b66",
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                >
                  Customize Avatar
                </Link>
              )}
            </div>
          </Card>

          <Card title="Stats">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.8 }}>Games played</span>
                <b>{data.stats.gamesPlayed}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.8 }}>Total chat</span>
                <b>{data.stats.totalChats}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.8 }}>✅ received</span>
                <b>{data.stats.totalPlus}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.8 }}>❌ received</span>
                <b>{data.stats.totalMinus}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.8 }}>POV wins</span>
                <b>{data.stats.totalPov}</b>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
