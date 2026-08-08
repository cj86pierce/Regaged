"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  slotDesigns?: Partial<Record<import("@/components/Avatar").SlotDesignType, string>>;
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
  gameId: string;
  players: Player[];
  me: null | { checks: number; health: number; keys: number };
  gameState: string;
}) {
  const { players, me, gameState } = props;
  const isCompleted = gameState === "COMPLETED";
  const columns = 10;
  const stripRef = useRef<HTMLDivElement>(null);
  const [avatarW, setAvatarW] = useState(72);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      setAvatarW(Math.max(40, Math.min(88, Math.floor(w / columns))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        borderRadius: 4,
        padding: 10,
      }}
    >
      <div className="gameCastingStripLayout" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12, alignItems: "start" }}>
        <div
          ref={stripRef}
          className="gameCastingStripPlayers"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 0,
            alignItems: "start",
            minWidth: 0,
          }}
        >
          {players.map((p) => {
            const out = p.status !== "ACTIVE";
            const place = p.eliminatedPlace ?? (isCompleted ? placeByUserId.get(p.userId) ?? null : null);
            const presence = presenceLabel(p.lastActiveAt);
            // When completed: grey everyone except 1st place (place === 1). If place is null we still grey.
            const grayscale = isCompleted ? place !== 1 : out;
            const presenceColor =
              presence.tone === "online" ? "var(--presence-online)" : presence.tone === "away" ? "var(--presence-away)" : "var(--presence-offline)";

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
                  padding: 0,
                  background: "transparent",
                  opacity: grayscale ? 0.7 : out && !isCompleted ? 0.45 : 1,
                  filter: grayscale ? "grayscale(100%)" : undefined,
                  WebkitFilter: grayscale ? "grayscale(100%)" : undefined,
                  transition: "filter 0.2s ease, opacity 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  minWidth: 0,
                }}
              >
                <div style={{ lineHeight: 0 }}>
                  <Avatar config={p.avatar} width={avatarW} grayscale={grayscale} slotDesigns={p.slotDesigns} flush />
                </div>

                <Link
                  href={`/u/${encodeURIComponent(p.username.toLowerCase())}`}
                  className="theme-username"
                  style={{
                    display: "block",
                    marginTop: 4,
                    padding: "0 2px",
                    fontSize: 11,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textDecoration: "none",
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
                    color: "var(--text-game)",
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
            borderRadius: 4,
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
            Nominations: low challenge score + low checks. Finals: keys decide.
          </div>

          <Link
            href={`/game/${props.gameId}/challenge`}
            style={{
              display: "block",
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--accent-bg)",
              fontWeight: 1000,
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Competition →
          </Link>
        </div>
      </div>
    </div>
  );
}
