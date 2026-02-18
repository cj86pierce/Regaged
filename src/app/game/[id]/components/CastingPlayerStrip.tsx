"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  eliminatedPlace: number | null;

  // from API
  lastActiveAt: string;
  isNominee: boolean;

  avatar: AvatarConfig;
};

function presenceLabel(lastActiveAtIso: string) {
  const ms = Date.now() - new Date(lastActiveAtIso).getTime();
  const mins = Math.floor(ms / 60000);

  if (!Number.isFinite(mins)) return { text: "offline", tone: "offline" as const };
  if (mins <= 2) return { text: "online", tone: "online" as const };
  if (mins <= 60) return { text: `${mins}m`, tone: "away" as const };
  return { text: "offline", tone: "offline" as const };
}

function placeSuffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export default function CastingPlayerStrip(props: {
  players: Player[];
  me: null | { checks: number; health: number; keys: number };
  gameState: string;
}) {
  const { players, me, gameState } = props;
  const isCompleted = gameState === "COMPLETED";

  const columnCount = Math.min(Math.max(players.length, 10), 20);
  return (
    <div
      style={{
        border: "1px solid #cfd7df",
        borderRadius: 10,
        padding: "6px 8px",
        background: "#eef7ff",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12, alignItems: "start" }}>
        {/* LEFT: same layout as Fasting – horizontal row, avatar → username → offline → placement */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            gap: 4,
            alignItems: "start",
          }}
        >
          {players.map((p) => {
            const out = p.status !== "ACTIVE";
            const place = p.eliminatedPlace;
            const presence = presenceLabel(p.lastActiveAt);
            const grayscale = isCompleted ? (place !== 1 && place != null) : out;
            const presenceColor =
              presence.tone === "online" ? "#198754" : presence.tone === "away" ? "#b58900" : "#6c757d";

            const slotContent = isCompleted
              ? (place != null ? placeSuffix(place) : "—")
              : p.isNominee
                ? "❓"
                : "✅";

            return (
              <div key={p.userId} style={{ minWidth: 0, opacity: out && !isCompleted ? 0.45 : 1 }}>
                <Link href={`/u/${encodeURIComponent(p.username.toLowerCase())}`} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
                  <Avatar config={p.avatar} width={64} grayscale={grayscale} />
                </Link>

                <Link
                  href={`/u/${encodeURIComponent(p.username.toLowerCase())}`}
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: 1000,
                    color: "#111",
                    textDecoration: "none",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={p.username}
                >
                  {p.username.length > 10 ? p.username.slice(0, 10) + "…" : p.username}
                </Link>

                <div style={{ fontSize: 10, opacity: 0.85, textAlign: "center", marginTop: 2 }}>
                  {presence.text}
                </div>

                <div style={{ marginTop: 3, height: 18, display: "grid", placeItems: "center" }}>
                  <span style={{ fontWeight: 1000, fontSize: 11 }}>{slotContent}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: your stats bubble */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            padding: 12,
            background: "linear-gradient(#fff, #f7f9fb)",
            minHeight: 140,
          }}
        >
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Your Stats</div>

          {me ? (
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>✅ Checks</span>
                <b>{me.checks}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>❤️ Health</span>
                <b>{me.health}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔑 Keys</span>
                <b>{me.keys}</b>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Login to see your stats.</div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.65, lineHeight: 1.35 }}>
            Castings: keys win. Ties: checks → health.
          </div>
        </div>
      </div>
    </div>
  );
}
