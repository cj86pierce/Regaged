"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ProfileTabsData = {
  isOwnProfile: boolean;
  username: string;
  joinedAt: string; // ISO
  karma: number;
  tMoney: number;
  colorName: string;
  colorAnimated: boolean;

  stats: {
    gamesPlayed: number;
    totalChats: number;
    totalPlus: number;
    totalMinus: number;
    totalPov: number;
  };

  recentGames: Array<{
    gameId: string;
    gameType: string;
    state: string;
    roundNumber: number;
    startedAt: string | null;
    completedAt: string | null;
    yourStatus: string; // ACTIVE/ELIMINATED
    eliminatedAt: string | null;
  }>;
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

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

export default function ProfileTabs({ data }: { data: ProfileTabsData }) {
  const [tab, setTab] = useState<"overview" | "games" | "blog" | "social">("overview");

  const joinedLabel = useMemo(() => {
    try {
      return new Date(data.joinedAt).toLocaleDateString();
    } catch {
      return data.joinedAt;
    }
  }, [data.joinedAt]);

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
      {/* Header / identity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        <Card title="Profile">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "linear-gradient(#f3f6f9, #fff)",
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                fontWeight: 1000,
                opacity: 0.75,
              }}
            >
              🙂
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 1000, letterSpacing: -0.2 }}>{data.username}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Joined {joinedLabel}</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Pill>Karma: {data.karma}</Pill>
                <Pill>T$: {data.tMoney}</Pill>
                <Pill>
                  {data.colorName}
                  {data.colorAnimated ? " (animated)" : ""}
                </Pill>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Public link:{" "}
                <Link href={`/u/${encodeURIComponent(data.username)}`} style={{ fontWeight: 900, color: "#0b5ed7" }}>
                  /u/{data.username}
                </Link>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {tabBtn("overview", "Overview")}
            {tabBtn("games", "Games")}
            {tabBtn("blog", "Blog")}
            {tabBtn("social", "Social")}
          </div>

          {/* Tab content */}
          <div style={{ marginTop: 14 }}>
            {tab === "overview" && (
              <div style={{ display: "grid", gap: 14 }}>
                <Card title="About">
                  <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.9 }}>
                    {data.isOwnProfile
                      ? "This is your profile. We’ll add editable bio + achievements next."
                      : "This user’s bio/description will show here once we add it."}
                  </div>
                </Card>

                <Card title="Quick Stats">
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Games played</span>
                      <b>{data.stats.gamesPlayed}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Total chat messages</span>
                      <b>{data.stats.totalChats}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Total ✅ received</span>
                      <b>{data.stats.totalPlus}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Total ❌ received</span>
                      <b>{data.stats.totalMinus}</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Total POV wins</span>
                      <b>{data.stats.totalPov}</b>
                    </div>
                  </div>
                </Card>

                <Card title="Recent Games">
                  {data.recentGames.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>No games yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {data.recentGames.slice(0, 8).map((g) => (
                        <div
                          key={g.gameId}
                          style={{
                            border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 12,
                            padding: 10,
                            background: "#fff",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 1000, color: "#0b5ed7" }}>
                              {g.gameType} · {g.state} (Round {g.roundNumber})
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                              You: <b>{g.yourStatus}</b>
                              {g.eliminatedAt ? ` · Eliminated ${new Date(g.eliminatedAt).toLocaleString()}` : ""}
                              {g.completedAt ? ` · Finished ${new Date(g.completedAt).toLocaleString()}` : ""}
                            </div>
                          </div>

                          <Link
                            href={`/game/${g.gameId}`}
                            style={{
                              textDecoration: "none",
                              fontWeight: 1000,
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(0,0,0,0.10)",
                              background: "#eaf2ff",
                              color: "#0b2b66",
                              textAlign: "center",
                            }}
                          >
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {tab === "games" && (
              <Card title="Games">
                <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                  Coming next: wins breakdown, placements, game history bubbles like classic Tengaged.
                </div>
              </Card>
            )}

            {tab === "blog" && (
              <Card title="Blog">
                <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                  Coming next: real blog posts + likes/comments, and homepage “Top Participants blogs” becomes real.
                </div>
              </Card>
            )}

            {tab === "social" && (
              <Card title="Social">
                <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                  Coming later: friends, groups, fraternity, bets — like the right sidebar in your screenshot.
                </div>
              </Card>
            )}
          </div>
        </Card>

        {/* Right sidebar (kept simple for now, will match screenshot later) */}
        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Actions">
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

              <Link href="/" style={{ fontWeight: 900, color: "#0b5ed7", textAlign: "center" }}>
                Back to home
              </Link>
            </div>
          </Card>

          <Card title="Notes">
            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
              We’ll reshape this sidebar to match your screenshot next (donations, friends grid, bets, etc.).
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
