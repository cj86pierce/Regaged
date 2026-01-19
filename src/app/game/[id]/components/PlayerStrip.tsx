"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  eliminatedPlace: number | null;
  isNominee: boolean;
  avatar: AvatarConfig;
};

export default function PlayerStrip(props: {
  players: Player[];
  povUserId: string | null;
  gameState: string;

  meUserId: string | null;

  // these control whether buttons show as already locked
  myNomLockedIn: boolean;
  myVoteLockedIn: string | null;

  // local selections
  nomSelected: string[];
  setNomSelected: (next: string[]) => void;

  evictSelected: string | null;
  setEvictSelected: (id: string | null) => void;
}) {
  const {
    players,
    povUserId,
    gameState,
    meUserId,
    myNomLockedIn,
    myVoteLockedIn,
    nomSelected,
    setNomSelected,
    evictSelected,
    setEvictSelected,
  } = props;

  const isNomPhase = gameState === "ROUND_NOMINATE";
  const isVotePhase = gameState === "ROUND_VOTE";

  function toggleNom(userId: string) {
    if (!isNomPhase) return;
    if (myNomLockedIn) return;
    if (userId === povUserId) return;

    setNomSelected((prev) => {
      const has = prev.includes(userId);
      if (has) return prev.filter((x) => x !== userId);
      if (prev.length >= 2) return prev;
      return [...prev, userId];
    });
  }

  function chooseEvict(userId: string) {
    if (!isVotePhase) return;
    if (myVoteLockedIn) return;
    setEvictSelected(userId);
  }

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        padding: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, overflowX: "auto", alignItems: "start" }}>
        {players.map((p, idx) => {
          const out = p.status !== "ACTIVE";
          const isPov = povUserId === p.userId;

          const canNominate =
            isNomPhase && !myNomLockedIn && !out && p.userId !== povUserId;

          const canEvict =
            isVotePhase && !myVoteLockedIn && !out && p.isNominee;

          const selectedNom = nomSelected.includes(p.userId);
          const selectedEvict = evictSelected === p.userId;

          return (
            <div
              key={p.userId}
              style={{
                minWidth: 120,
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 10,
                padding: 8,
                background: out ? "rgba(0,0,0,0.03)" : "#fff",
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

              {/* status row */}
              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.85 }}>
                <span>{out ? "OUT" : `#${idx + 1}`}</span>
                <span>
                  {isPov ? "⭐" : p.isNominee ? "❓" : "✅"}
                </span>
              </div>

              {/* nominate button (FASTING only) */}
              {canNominate && (
                <button
                  onClick={() => toggleNom(p.userId)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: selectedNom ? "#111" : "#fff",
                    color: selectedNom ? "#fff" : "#111",
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  Nominate
                </button>
              )}

              {/* evict button (FASTING only) */}
              {canEvict && (
                <button
                  onClick={() => chooseEvict(p.userId)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: selectedEvict ? "#111" : "#fff",
                    color: selectedEvict ? "#fff" : "#111",
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  Evict
                </button>
              )}

              {/* locked indicators */}
              {isNomPhase && myNomLockedIn && (
                <div style={{ marginTop: 6, fontSize: 11, textAlign: "center", opacity: 0.75 }}>
                  Nom locked in
                </div>
              )}
              {isVotePhase && myVoteLockedIn && (
                <div style={{ marginTop: 6, fontSize: 11, textAlign: "center", opacity: 0.75 }}>
                  Vote locked in
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
