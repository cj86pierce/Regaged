"use client";

import Link from "next/link";
import { useEffect } from "react";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string | Date;
  eliminatedPlace: number | null;
  isNominee: boolean;
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

  // lock states (user-specific)
  myNomLockedIn: boolean;
  myVoteLockedIn: string | null;

  // selection state
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

  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";

  const meIsNominee = !!meUserId && players.some((p) => p.userId === meUserId && p.isNominee);

  // clear selections when phase changes or locks happen
  useEffect(() => {
    if (!isNominate) setNomSelected([]);
    if (!isVote) setEvictSelected(null);
    if (myNomLockedIn) setNomSelected([]);
    if (myVoteLockedIn) setEvictSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, myNomLockedIn, myVoteLockedIn]);

  function toggleNomPick(userId: string) {
    const has = nomSelected.includes(userId);
    if (has) {
      setNomSelected(nomSelected.filter((x) => x !== userId));
      return;
    }
    if (nomSelected.length >= 2) return;
    setNomSelected([...nomSelected, userId]);
  }

  function toggleEvictPick(userId: string) {
    setEvictSelected(evictSelected === userId ? null : userId);
  }

  const tileW = 64;
  const avatarH = 80;

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
      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "flex-start" }}>
        {players.map((p) => {
          const eliminated = p.status === "ELIMINATED";
          const isPov = p.userId === povUserId;
          const mins = minutesSince(p.lastActiveAt);

          // --- Indicator logic (slot where ✅/❓/POV/placement shows) ---
          let indicatorText = "";

          if (eliminated && p.eliminatedPlace) {
            indicatorText = suffix(p.eliminatedPlace); // 15th, 14th...
          } else if (isVote && myVoteLockedIn) {
            // After voting: nominees show ❓, others show ✅ (POV overrides ✅)
            if (p.isNominee) indicatorText = "❓";
            else indicatorText = isPov ? "POV" : "✅";
          } else if (isNominate && myNomLockedIn) {
            // After nom locked: everyone shows ✅ except POV shows POV
            indicatorText = isPov ? "POV" : "✅";
          } else {
            // Before locks: indicator area is handled by boxes below
            indicatorText = "";
          }

          // --- Selection box rules ---
          const showNomBox = isNominate && !myNomLockedIn && !eliminated && !isPov;
          const showVoteBox = isVote && !myVoteLockedIn && !eliminated && p.isNominee;

          const nomOn = nomSelected.includes(p.userId);
          const evictOn = evictSelected === p.userId;

          // Disabled vote selection if you are a nominee (nominees cannot vote)
          const voteBoxDisabled = meIsNominee;

          return (
            <div key={p.userId} style={{ width: tileW }}>
              {/* Avatar (ONLY eliminated is grayscale) */}
              <div
                style={{
                  width: tileW,
                  height: avatarH,
                  borderRadius: 6,
                  background: eliminated ? "#6f7781" : "#f5f7fa",
                  border: "1px solid rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  filter: eliminated ? "grayscale(1)" : "none",
                  opacity: eliminated ? 0.8 : 1,
                }}
                title={p.username}
              >
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 18, opacity: 0.7 }}>
                  🙂
                </div>
              </div>

              {/* Name */}
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

              {/* last active */}
              <div style={{ fontSize: 10, opacity: 0.85, textAlign: "center", marginTop: 2 }}>
                {mins >= 60 ? "offline" : `${mins} min`}
              </div>

              {/* indicator slot (replaces ✅/❓/POV/placement) */}
              <div style={{ height: 16, marginTop: 2, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 1000 }}>
                {indicatorText}
              </div>

              {/* selection box slot */}
              <div style={{ height: 20, marginTop: 2, display: "grid", placeItems: "center" }}>
                {showNomBox ? (
                  <button
                    onClick={() => toggleNomPick(p.userId)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: nomOn ? "#111" : "#fff",
                      cursor: "pointer",
                    }}
                    title="Select nominee"
                  />
                ) : showVoteBox ? (
                  <button
                    disabled={voteBoxDisabled}
                    onClick={() => toggleEvictPick(p.userId)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: evictOn ? "#111" : "#fff",
                      cursor: voteBoxDisabled ? "not-allowed" : "pointer",
                      opacity: voteBoxDisabled ? 0.5 : 1,
                    }}
                    title={voteBoxDisabled ? "Nominees cannot vote" : "Select to evict"}
                  />
                ) : (
                  <div />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
