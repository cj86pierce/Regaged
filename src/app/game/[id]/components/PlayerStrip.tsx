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

  // nomination selection
  nomSelected: string[];
  setNomSelected: (next: string[]) => void;

  // eviction selection
  evictSelected: string | null;
  setEvictSelected: (id: string | null) => void;
}) {
  const { players, povUserId, gameState, nomSelected, setNomSelected, evictSelected, setEvictSelected } = props;

  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";

  const povName = useMemo(() => {
    if (!povUserId) return null;
    return players.find((p) => p.userId === povUserId)?.username ?? null;
  }, [players, povUserId]);

  // reset selections when phase changes
  useEffect(() => {
    if (!isNominate) setNomSelected([]);
    if (!isVote) setEvictSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

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
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, opacity: 0.85 }}>
        POV: <span style={{ fontWeight: 1000 }}>{povName ?? "—"}</span>
        {isNominate && <span style={{ marginLeft: 10, opacity: 0.75 }}>(select 2)</span>}
        {isVote && <span style={{ marginLeft: 10, opacity: 0.75 }}>(select 1 nominee)</span>}
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "flex-start" }}>
        {players.map((p) => {
          const eliminated = p.status === "ELIMINATED";
          const isPov = p.userId === povUserId;
          const mins = minutesSince(p.lastActiveAt);

          const canNomPick = isNominate && !eliminated && !isPov;
          const canEvictPick = isVote && !eliminated && p.isNominee;

          const nomOn = nomSelected.includes(p.userId);
          const evictOn = evictSelected === p.userId;

          const bottom =
            eliminated && p.eliminatedPlace ? suffix(p.eliminatedPlace) : "";

          return (
            <div key={p.userId} style={{ width: tileW }}>
              <div
                style={{
                  width: tileW,
                  height: avatarH,
                  borderRadius: 6,
                  background: eliminated ? "#6f7781" : "#f5f7fa",
                  border: "1px solid rgba(0,0,0,0.15)",
                  position: "relative",
                  overflow: "hidden",
                  filter: "grayscale(1)",
                  opacity: eliminated ? 0.75 : 1,
                }}
                title={p.username}
              >
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 18, opacity: 0.7 }}>
                  🙂
                </div>

                {isPov && (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: "#fff3cd",
                      border: "1px solid #e5c46a",
                      borderRadius: 999,
                      padding: "2px 6px",
                      fontSize: 9,
                      fontWeight: 900,
                      filter: "none",
                    }}
                  >
                    POV
                  </div>
                )}
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
                {mins >= 60 ? "offline" : `${mins} min`}
              </div>

              <div style={{ fontSize: 10, fontWeight: 1000, textAlign: "center", marginTop: 2, opacity: 0.9 }}>
                {bottom}
              </div>

              <div style={{ display: "grid", placeItems: "center", marginTop: 4 }}>
                {isNominate ? (
                  <button
                    disabled={!canNomPick}
                    onClick={() => toggleNomPick(p.userId)}
                    title={canNomPick ? "Select nominee" : eliminated ? "Eliminated" : isPov ? "POV immune" : ""}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: nomOn ? "#111" : "#fff",
                      cursor: canNomPick ? "pointer" : "not-allowed",
                    }}
                  />
                ) : isVote ? (
                  <button
                    disabled={!canEvictPick}
                    onClick={() => toggleEvictPick(p.userId)}
                    title={canEvictPick ? "Select to evict" : ""}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: evictOn ? "#111" : "#fff",
                      cursor: canEvictPick ? "pointer" : "not-allowed",
                    }}
                  />
                ) : (
                  <div style={{ height: 18 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
