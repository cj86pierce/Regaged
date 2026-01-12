"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string | Date;
  eliminatedPlace: number | null;
  isNominee: boolean;
  hasVoted: boolean | null; // null if not eligible or not in vote phase
};

function trunc(name: string, max = 10) {
  return name.length > max ? name.slice(0, max) + "…" : name;
}

function suffix(n: number) {
  const j = n % 10,
    k = n % 100;
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

export default function PlayerStrip({
  players,
  povUserId,
  gameState,
  meUserId,

  // nomination
  myNomLockedIn,
  onSubmitNoms,

  // voting
  myVoteLockedIn,
  onEvict,
}: {
  players: Player[];
  povUserId: string | null;
  gameState: string;
  meUserId: string | null;

  myNomLockedIn: boolean;
  onSubmitNoms: (targets: string[]) => Promise<void>;

  myVoteLockedIn: string | null;
  onEvict: (targetUserId: string) => Promise<void>;
}) {
  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";

  // local nominee selection lives in the strip now
  const [nomPicks, setNomPicks] = useState<string[]>([]);

  // reset picks when phase changes / after locking
  useEffect(() => {
    setNomPicks([]);
  }, [gameState, myNomLockedIn]);

  const canPickNoms = isNominate && !myNomLockedIn;

  const povName = useMemo(() => {
    if (!povUserId) return null;
    return players.find((p) => p.userId === povUserId)?.username ?? null;
  }, [players, povUserId]);

  function togglePick(userId: string) {
    setNomPicks((prev) => {
      if (prev.includes(userId)) return prev.filter((x) => x !== userId);
      if (prev.length >= 2) return prev;
      return [...prev, userId];
    });
  }

  const tileW = 64;
  const tileH = 142;

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
      {/* POV strip label */}
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, opacity: 0.85 }}>
        POV: <span style={{ fontWeight: 1000 }}>{povName ?? "—"}</span>
        {isNominate && <span style={{ marginLeft: 10, opacity: 0.75 }}>(click 2 players to nominate)</span>}
        {isVote && <span style={{ marginLeft: 10, opacity: 0.75 }}>(evict a nominee)</span>}
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "flex-start" }}>
        {players.map((p) => {
          const isPov = p.userId === povUserId;
          const eliminated = p.status === "ELIMINATED";
          const mins = minutesSince(p.lastActiveAt);

          // clock: show if eligible voter and hasVoted === false
          const showClock = p.hasVoted === false;

          // bottom slot: placement if eliminated, else nominee ?, else active ✓
          const bottom =
            eliminated && p.eliminatedPlace ? suffix(p.eliminatedPlace) : !eliminated && p.isNominee ? "❓" : !eliminated ? "✅" : "";

          // nomination selection rules
          const canBeNominated = canPickNoms && !eliminated && !isPov;
          const isPicked = nomPicks.includes(p.userId);

          // vote rules: only nominees are clickable to evict; only if you haven't locked vote
          const canEvict = isVote && !myVoteLockedIn && p.isNominee && !eliminated;

          // styles
          const borderColor = p.isNominee ? "#111" : "rgba(0,0,0,0.25)";
          const bg = eliminated ? "#9aa2ab" : "#fff";

          return (
            <div key={p.userId} style={{ width: tileW }}>
              {/* avatar card */}
              <div
                style={{
                  width: tileW,
                  height: tileH,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 8,
                  background: bg,
                  opacity: eliminated ? 0.9 : 1,
                  position: "relative",
                  boxSizing: "border-box",
                  padding: 4,
                  outline: isPicked ? "3px solid #2a7f44" : "none",
                  outlineOffset: 1,
                  cursor: canBeNominated ? "pointer" : "default",
                }}
                onClick={() => {
                  if (canBeNominated) togglePick(p.userId);
                }}
                title={
                  canBeNominated
                    ? "Click to select nominee"
                    : canEvict
                    ? "Use evict button"
                    : p.username
                }
              >
                {/* vote clock */}
                {showClock && (
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 3,
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.75)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      zIndex: 3,
                    }}
                    title="Has not voted"
                  >
                    🕒
                  </div>
                )}

                {/* POV badge */}
                {isPov && (
                  <div
                    style={{
                      position: "absolute",
                      top: -7,
                      right: -7,
                      background: "#fff3cd",
                      border: "1px solid #e5c46a",
                      borderRadius: 999,
                      padding: "2px 6px",
                      fontSize: 9,
                      fontWeight: 900,
                      zIndex: 4,
                    }}
                  >
                    POV
                  </div>
                )}

                {/* avatar */}
                <div
                  style={{
                    width: "100%",
                    height: 84,
                    borderRadius: 6,
                    background: eliminated ? "#7f8790" : "#f5f7fa",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 16,
                    opacity: 0.65,
                  }}
                >
                  🙂
                </div>

                {/* name (clickable to profile) */}
                <Link
                  href={`/u/${encodeURIComponent(p.username)}`}
                  style={{
                    display: "block",
                    marginTop: 6,
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
                  onClick={(e) => e.stopPropagation()}
                >
                  {trunc(p.username, 10)}
                </Link>

                {/* mins */}
                <div style={{ fontSize: 10, opacity: 0.85, marginTop: 3, textAlign: "center" }}>{mins} min</div>

                {/* bottom status */}
                <div style={{ fontSize: 12, fontWeight: 1000, marginTop: 3, textAlign: "center" }}>{bottom}</div>

                {/* vote action on nominee cards */}
                {canEvict && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEvict(p.userId);
                    }}
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      right: 4,
                      padding: "6px 6px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.20)",
                      background: "#111",
                      color: "#fff",
                      fontWeight: 1000,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    EVICT
                  </button>
                )}
              </div>

              {/* nomination submit button shown under strip (only once), but selection is on cards */}
              {/* (We keep it under the strip instead of inside each card to prevent spam clicks) */}
            </div>
          );
        })}
      </div>

      {/* nomination submit row */}
      {isNominate && (
        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {myNomLockedIn ? (
            <div style={{ fontWeight: 1000, color: "#198754" }}>✅ Nominations locked in.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Selected: <b>{nomPicks.length}/2</b>
              </div>
              <button
                disabled={nomPicks.length !== 2}
                onClick={() => onSubmitNoms(nomPicks)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: nomPicks.length === 2 ? "#111" : "#f3f6f9",
                  color: nomPicks.length === 2 ? "#fff" : "#111",
                  cursor: nomPicks.length === 2 ? "pointer" : "not-allowed",
                  fontWeight: 1000,
                }}
              >
                Submit Nominations
              </button>
            </>
          )}
        </div>
      )}

      {/* voting locked */}
      {isVote && myVoteLockedIn && (
        <div style={{ marginTop: 8, fontWeight: 1000, color: "#198754" }}>✅ Vote locked in.</div>
      )}
    </div>
  );
}
