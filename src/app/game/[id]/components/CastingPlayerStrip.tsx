"use client";

import { useMemo } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";
import { formatLastSeen } from "@/lib/lastSeenLabel";

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
  const text = formatLastSeen(lastActiveAtIso);
  if (text === "online") return { text: "online", tone: "online" as const };
  if (text === "offline") return { text: "offline", tone: "offline" as const };
  return { text, tone: "away" as const };
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

  // When completed, build display place for each player (use eliminatedPlace when set; else final-4 get 1–4 by order)
  const placeByUserId = useMemo(() => {
    if (!isCompleted || players.length === 0) return new Map<string, number>();
    const sorted = [...players].sort((a, b) => (a.eliminatedPlace ?? 0) - (b.eliminatedPlace ?? 0));
    const map = new Map<string, number>();
    sorted.forEach((p, i) => map.set(p.userId, p.eliminatedPlace ?? i + 1));
    return map;
  }, [isCompleted, players]);

  return (
    <div
      className="gameCastingStrip theme-sidebar-panel"
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div className="gameCastingStripLayout" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12, alignItems: "start" }}>
        <div
          className="gameCastingStripPlayers"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
            alignItems: "start",
          }}
        >
          {players.map((p) => {
            const out = p.status !== "ACTIVE";
            const place = p.eliminatedPlace ?? (isCompleted ? placeByUserId.get(p.userId) ?? null : null);
            const presence = presenceLabel(p.lastActiveAt);
            // When completed: grey everyone except 1st place (place === 1). If place is null we still grey.
            const grayscale = isCompleted ? place !== 1 : out;
            const presenceColor =
              presence.tone === "online" ? "#198754" : presence.tone === "away" ? "#b58900" : "#6c757d";

            const icon = isCompleted
              ? (place != null ? placeSuffix(place) : "—")
              : p.isNominee
                ? "❓"
                : "✅";

            return (
              <div
                key={p.userId}
                className="gameCastingStripItem"
                style={{
                  padding: 8,
                  background: "transparent",
                  opacity: grayscale ? 0.7 : out && !isCompleted ? 0.45 : 1,
                  filter: grayscale ? "grayscale(100%)" : undefined,
                  WebkitFilter: grayscale ? "grayscale(100%)" : undefined,
                  transition: "filter 0.2s ease, opacity 0.2s ease",
                }}
              >
                <div style={{ display: "grid", placeItems: "center" }}>
                  <Avatar config={p.avatar} width={64} grayscale={grayscale} />
                </div>

                <Link
                  href={`/u/${encodeURIComponent(p.username.toLowerCase())}`}
                  style={{
                    display: "block",
                    marginTop: 6,
                    fontWeight: 1000,
                    fontSize: 12,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textDecoration: "none",
                    color: "#111",
                  }}
                  title={p.username}
                >
                  {p.username}
                </Link>

                <div style={{ marginTop: 4, fontSize: 11, textAlign: "center", color: presenceColor, fontWeight: 900, minHeight: 16 }}>
                  {!isCompleted && presence.text}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    minHeight: 20,
                    fontSize: isCompleted ? 14 : 13,
                    fontWeight: isCompleted ? 800 : undefined,
                    textAlign: "center",
                    color: "#111",
                  }}
                >
                  {icon}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: your stats bubble */}
        <div
          className="gameCastingStripStats"
          style={{
            border: "1px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            padding: 12,
            background: "var(--bg-card)",
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
