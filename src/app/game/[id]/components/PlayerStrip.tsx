"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string;
  eliminatedPlace: number | null;
  isNominee: boolean;

  // ✅ new stats from API
  checks: number;
  health: number;
  keys: number;

  avatar: AvatarConfig;
};

export default function PlayerStrip(props: {
  players: Player[];
  povUserId: string | null;
  gameState: string;
  gameType: string;

  // FASTING-only props (still passed, ignored for CASTING)
  meUserId: string | null;
  myNomLockedIn: boolean;
  myVoteLockedIn: string | null;

  nomSelected: string[];
  setNomSelected: (next: string[]) => void;

  evictSelected: string | null;
  setEvictSelected: (id: string | null) => void;
}) {
  const { players, gameType } = props;
  const isCasting = gameType === "CASTING";
  const isFasting = gameType === "FASTING";

  // 10x2 grid for castings (20 players)
  if (isCasting) {
    return (
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 12,
          background: "#fff",
          padding: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
            alignItems: "start",
          }}
        >
          {players.map((p, idx) => {
            const grayscale = p.status !== "ACTIVE";
            const place = p.eliminatedPlace ?? (p.status === "ACTIVE" ? null : undefined);

            return (
              <Link
                key={p.userId}
                href={`/u/${encodeURIComponent(p.username.toLowerCase())}`}
                style={{
                  textDecoration: "none",
                  color: "#111",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.10)",
                  padding: 6,
                  display: "grid",
                  gap: 6,
                  background: "#fff",
                }}
              >
                <div style={{ display: "grid", placeItems: "center" }}>
                  <Avatar config={p.avatar} width={64} grayscale={grayscale} />
                </div>

                <div
                  title={p.username}
                  style={{
                    fontWeight: 1000,
                    fontSize: 11,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.username}
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.85 }}>
                    <span>✅</span>
                    <b>{p.checks}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.85 }}>
                    <span>❤️</span>
                    <b>{p.health}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.85 }}>
                    <span>🔑</span>
                    <b>{p.keys}</b>
                  </div>
                </div>

                <div style={{ fontSize: 10, textAlign: "center", opacity: 0.7 }}>
                  {p.status !== "ACTIVE" ? (place ? `${place}` : "OUT") : `#${idx + 1}`}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // FASTING: keep your existing UI behavior by reusing whatever you had before.
  // If you previously had custom nominate/evict icons, that logic stays in your existing file.
  // For now, we’ll render a simple row fallback if you want:
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
        display: "flex",
        gap: 8,
        overflowX: "auto",
      }}
    >
      {players.map((p) => (
        <div
          key={p.userId}
          style={{
            minWidth: 120,
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 10,
            padding: 8,
          }}
        >
          <div style={{ display: "grid", placeItems: "center" }}>
            <Avatar config={p.avatar} width={64} grayscale={p.status !== "ACTIVE"} />
          </div>
          <div
            style={{
              marginTop: 6,
              fontWeight: 1000,
              fontSize: 12,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={p.username}
          >
            {p.username}
          </div>
        </div>
      ))}
    </div>
  );
}
