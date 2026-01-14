"use client";

import Link from "next/link";
import Avatar, { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string | Date;
  eliminatedPlace: number | null;
  isNominee: boolean;
  avatar: AvatarConfig;
};

function trunc(name: string, max = 10) {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

function suffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function minutesSince(d: string | Date) {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const mins = Math.floor((Date.now() - t) / 60000);
  return Math.max(0, Math.min(60, mins));
}

export default function PlayerStrip(props: {
  players: Player[];
  povUserId: string | null;
  gameState: string;
  meUserId: string | null;

  myNomLockedIn: boolean;
  myVoteLockedIn: string | null;

  nomSelected: string[];
  setNomSelected: (next: string[]) => void;

  evictSelected: string | null;
  setEvictSelected: (id: string | null) => void;
}) {
  const {
    players,
    povUserId,
    gameState,
    myNomLockedIn,
    myVoteLockedIn,
    nomSelected,
    setNomSelected,
    evictSelected,
    setEvictSelected,
  } = props;

  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";
  const isCompleted = gameState === "COMPLETED";

  function toggleNomPick(userId: string) {
    const has = nomSelected.includes(userId);
    if (has) return setNomSelected(nomSelected.filter((x) => x !== userId));
    if (nomSelected.length >= 2) return;
    setNomSelected([...nomSelected, userId]);
  }

  function setEvict(userId: string) {
    setEvictSelected(userId);
  }

  // ✅ exactly 15 columns worth of layout; no “16th slot”
  // (If a game has fewer than 15 players, columns still exist but simply contain fewer cards.)
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
          gap: 4,
          alignItems: "start",
        }}
      >
        {players.map((p) => {
          const isPov = p.userId === povUserId;
          const mins = minutesSince(p.lastActiveAt);
          const place = p.eliminatedPlace;

          // ✅ COMPLETED: only winner stays colored, everyone else grey
          const grayscale = isCompleted ? place !== 1 : p.status === "ELIMINATED";

          const canNominateThisPlayer =
            isNominate && !myNomLockedIn && p.status === "ACTIVE" && !isPov;

          const canEvictThisPlayer =
            isVote && !myVoteLockedIn && p.status === "ACTIVE" && p.isNominee;

          const nomOn = nomSelected.includes(p.userId);
          const evictOn = evictSelected === p.userId;

          // ✅ Indicator/action slot content (this is the key change)
          // Priority:
          // 1) placement
          // 2) POV badge (always visible)
          // 3) action buttons (Nominate/Evict) during live phases
          // 4) ✅/❓ after vote lock
          let slot: React.ReactNode = null;

          if (place) {
            slot = <span style={{ fontWeight: 1000, fontSize: 11 }}>{suffix(place)}</span>;
          } else if (isPov) {
            slot = (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "#ffeb3b",
                  border: "2px solid #ffffff",
                  fontWeight: 1000,
                  fontSize: 10,
                  lineHeight: "12px",
                }}
              >
                POV
              </span>
            );
          } else if (canNominateThisPlayer) {
            slot = (
              <button
                onClick={() => toggleNomPick(p.userId)}
                style={{
                  height: 18,
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.25)",
                  background: nomOn ? "#111" : "#fff",
                  color: nomOn ? "#fff" : "#111",
                  fontWeight: 1000,
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Nominate
              </button>
            );
          } else if (canEvictThisPlayer) {
            slot = (
              <button
                onClick={() => setEvict(p.userId)}
                style={{
                  height: 18,
                  width: "100%",
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.25)",
                  background: evictOn ? "#111" : "#fff",
                  color: evictOn ? "#fff" : "#111",
                  fontWeight: 1000,
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Evict
              </button>
            );
          } else if (isVote && myVoteLockedIn) {
            slot = <span style={{ fontWeight: 1000, fontSize: 11 }}>{p.isNominee ? "❓" : "✅"}</span>;
          } else if (isNominate && myNomLockedIn) {
            slot = <span style={{ fontWeight: 1000, fontSize: 11 }}>✅</span>;
          } else {
            slot = <span style={{ fontSize: 10, opacity: 0.35 }}>•</span>;
          }

          return (
            <div key={p.userId} style={{ minWidth: 0 }}>
              <div style={{ display: "grid", placeItems: "center" }}>
                <Avatar config={p.avatar} width={64} grayscale={grayscale} />
              </div>

              <Link
                href={`/u/${encodeURIComponent(p.username)}`}
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#0b5ed7",
                  textDecoration: "underline",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={p.username}
              >
                {trunc(p.username, 10)}
              </Link>

              <div style={{ fontSize: 10, opacity: 0.85, textAlign: "center", marginTop: 2 }}>
                {mins >= 60 ? "offline" : `${mins}m`}
              </div>

              {/* ✅ unified indicator/action slot */}
              <div style={{ marginTop: 3, height: 18, display: "grid", placeItems: "center" }}>
                {slot}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
