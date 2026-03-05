"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Game = {
  gameId: string;
  number: number;
  gameType: string;
  state: string;
  roundNumber: number;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="theme-card">
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 1000, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

function GameBtn({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link href={href} className="theme-game-btn">
      <div style={{ fontWeight: 1000, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>
    </Link>
  );
}

const POLL_MS = 5000;

export default function RightRailClient() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchGames() {
    try {
      const res = await fetch("/api/me/active-games", { cache: "no-store", credentials: "include" });
      const json = await res.json();
      if (res.ok) setGames(json.games ?? []);
      else setGames([]);
      setError(null);
    } catch {
      setError("Failed to load");
    }
  }

  useEffect(() => {
    fetchGames();
    const t = setInterval(fetchGames, POLL_MS);
    return () => clearInterval(t);
  }, []);

  if (games === null) {
    return (
      <Card title="My Active Games">
        <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="My Active Games">
        <div style={{ fontSize: 12, color: "var(--text-error)" }}>{error}</div>
      </Card>
    );
  }

  return (
    <Card title="My Active Games">
      {games.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {games.map((g) => {
            const sub =
              g.state === "ENROLLING"
                ? "Lobby"
                : g.gameType.startsWith("CASTING")
                  ? `Day ${g.roundNumber}`
                  : `Round ${g.roundNumber}`;
            return (
              <GameBtn
                key={g.gameId}
                href={`/game/${g.gameId}`}
                label={`${g.gameType} #${g.number}`}
                sub={sub}
              />
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No active games.</div>
      )}
    </Card>
  );
}
