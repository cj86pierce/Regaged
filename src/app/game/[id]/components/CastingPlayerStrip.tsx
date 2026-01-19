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

export default function CastingPlayerStrip(props: {
  players: Player[];
  me: null | { checks: number; health: number; keys: number };
}) {
  const { players, me } = props;

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
      }}
    >
      {/* identical to fasting top box feel: players left, your stats bubble right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12, alignItems: "start" }}>
        {/* LEFT: players 10 over 10 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
            alignItems: "start",
          }}
        >
          {players.map((p) => {
            const out = p.status !== "ACTIVE";
            const icon = p.isNominee ? "❓" : "✅";
            const presence = presenceLabel(p.lastActiveAt);

            const presenceColor =
              presence.tone === "online" ? "#198754" : presence.tone === "away" ? "#b58900" : "#6c757d";

            return (
              <div
                key={p.userId}
                style={{
                  padding: 8,
                  background: "transparent", // ✅ no tile box
                  opacity: out ? 0.45 : 1,
                }}
              >
                <div style={{ display: "grid", placeItems: "center" }}>
                  <Avatar config={p.avatar} width={64} grayscale={out} />
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

                {/* ✅ presence line */}
                <div style={{ marginTop: 4, fontSize: 11, textAlign: "center", color: presenceColor, fontWeight: 900 }}>
                  {presence.text}
                </div>

                {/* ✅ status: checkmark if in, ? if nominated */}
                <div style={{ marginTop: 6, fontSize: 13, textAlign: "center" }}>
                  {icon}
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
