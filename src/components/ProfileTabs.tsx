"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
    <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 1000 }}>{title}</div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", fontWeight: 900, fontSize: 12 }}>
      {children}
    </span>
  );
}

function onlineLabel(lastSeenAtIso: string) {
  const ms = Date.now() - new Date(lastSeenAtIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins <= 2) return { text: "online", style: { background: "#d1e7dd" } };
  if (mins <= 60) return { text: `${mins} min`, style: { background: "#fff3cd" } };
  return { text: "offline", style: { background: "#f8d7da" } };
}

export default function ProfileTabs({ data }: { data: ProfileTabsData }) {
  const [tab, setTab] = useState<"overview" | "games" | "blog" | "social">("overview");

  const joinedLabel = useMemo(() => new Date(data.joinedAt).toLocaleDateString(), [data.joinedAt]);
  const presence = useMemo(() => onlineLabel(data.lastSeenAt), [data.lastSeenAt]);

  const tabBtn = (key: typeof tab, label: string) => {
    const active = tab === key;
    return (
      <button
        onClick={() => setTab(key)}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.10)",
          background: active ? "#ffffff" : "#f3f6f9",
          fontWeight: 1000,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <main style={{ padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        <Card title="Profile">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar config={data.avatar} size={84} />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 1000, letterSpacing: -0.2 }}>{data.username}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Joined {joinedLabel}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>Karma: {data.karma}</Pill>
                <Pill>T$: {data.tMoney}</Pill>
                <Pill>{data.colorName}{data.colorAnimated ? " (animated)" : ""}</Pill>

                <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.08)", fontWeight: 1000, fontSize: 12, ...presence.style }}>
                  {presence.text}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {tabBtn("overview", "Overview")}
            {tabBtn("games", "Games")}
            {tabBtn("blog", "Blog")}
            {tabBtn("social", "Social")}
          </div>

          <div style={{ marginTop: 14 }}>
            {tab === "overview" && (
              <div style={{ opacity: 0.85 }}>
                (Everything else unchanged — recent games, etc. stays as you have it.)
              </div>
            )}
          </div>
        </Card>

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
