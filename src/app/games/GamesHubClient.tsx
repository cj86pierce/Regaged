"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type GameRow = {
  id: string;
  number: number;
  gameType: string;
  state: string;
  completedAt?: string | null;
};

type ChatRow = {
  id: string;
  body: string;
  createdAt: string;
  gameId: string;
  gameNumber: number;
  gameType: string;
  username: string;
};

type Feed = { active: GameRow[]; past: GameRow[]; chat: ChatRow[] };

export default function GamesHubClient(props: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(props.initial);

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/games/feed", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as Feed;
      setFeed(json);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(poll, 9000);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Stars stub — gold & navy */}
      <section
        style={{
          padding: 14,
          borderRadius: 12,
          minHeight: 64,
          background: "linear-gradient(135deg, #0a1628 0%, #13294b 55%, #1a3358 100%)",
          border: "1px solid #c9a227",
          boxShadow: "inset 0 0 0 1px rgba(201,162,39,0.25)",
        }}
      >
        <div style={{ fontWeight: 1000, color: "#f0d78c", letterSpacing: 0.2 }}>Stars</div>
        <div style={{ fontSize: 12, color: "rgba(240,215,140,0.75)", marginTop: 4 }}>
          Gold & navy · Coming soon
        </div>
      </section>

      <div
        className="gamesHubGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.7fr 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        {/* Site-wide chat (read-only) */}
        <section
          className="theme-sidebar-panel"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            maxHeight: 520,
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 1000, marginBottom: 8, color: "var(--brand)" }}>
            Live game chat
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>
            Read-only feed from active games. Click a game # to spectate.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {feed.chat.map((m) => (
              <div key={m.id} style={{ fontSize: 13, lineHeight: 1.35 }}>
                <Link
                  href={`/game/${m.gameId}`}
                  style={{ fontWeight: 900, textDecoration: "none", color: "var(--brand)" }}
                >
                  #{m.gameNumber}
                </Link>{" "}
                <span style={{ fontWeight: 800 }}>{m.username}</span>
                <div style={{ opacity: 0.9, wordBreak: "break-word" }}>
                  {m.body.length > 180 ? `${m.body.slice(0, 180)}…` : m.body}
                </div>
              </div>
            ))}
            {!feed.chat.length && (
              <div style={{ fontSize: 12, opacity: 0.65 }}>No recent messages.</div>
            )}
          </div>
        </section>

        {/* Past games */}
        <section
          className="theme-sidebar-panel"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            maxHeight: 520,
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 1000, marginBottom: 8, color: "var(--brand)" }}>
            Past games
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {feed.past.map((g) => (
              <Link
                key={g.id}
                href={`/game/${g.id}`}
                style={{
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontWeight: 800,
                  opacity: 0.85,
                }}
              >
                {g.gameType} #{g.number}
              </Link>
            ))}
            {!feed.past.length && (
              <div style={{ fontSize: 12, opacity: 0.65 }}>No completed games yet.</div>
            )}
          </div>
        </section>

        {/* Active games */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
              gap: 8,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, color: "var(--brand)" }}>Active games</h2>
            <Link href="/enroll" style={{ fontSize: 13, fontWeight: 800 }}>
              Enroll →
            </Link>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {feed.active.map((g) => (
              <Link
                key={g.id}
                href={`/game/${g.id}`}
                className="gamesListItem"
                style={{
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  background: "var(--bg-card)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 1000 }}>
                  {g.gameType} #{g.number}
                </div>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>{g.state}</div>
              </Link>
            ))}
            {!feed.active.length && (
              <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12 }}>
                No active games right now.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
