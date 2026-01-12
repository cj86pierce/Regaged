"use client";

import Link from "next/link";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string | Date;
  eliminatedPlace: number | null; // includes 1/2/3 at end
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

  function toggleEvictPick(userId: string) {
    setEvictSelected(evictSelected === userId ? null : userId);
  }

  const tileW = 64;
  const avatarH = 80;

  return (
    <div style={{ border: "1px solid #cfd7df", borderRadius: 10, padding: "6px 8px", background: "#eef7ff", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "flex-start" }}>
        {players.map((p) => {
          const isPov = p.userId === povUserId;
          const mins = minutesSince(p.lastActiveAt);

          const place = p.eliminatedPlace;

          // endgame grayscale rules:
          // - eliminated always grey
          // - when completed: 2nd/3rd grey, 1st stays colored
          const endGrey = isCompleted && (place === 2 || place === 3);
          const eliminatedGrey = p.status === "ELIMINATED";
          const grayscale = eliminatedGrey || endGrey;

          // selection logic
          const canNomPick = isNominate && !myNomLockedIn && p.status !== "ELIMINATED" && !isPov;
          const canEvictPick = isVote && !myVoteLockedIn && p.status !== "ELIMINATED" && p.isNominee;

          const showNomBox = isNominate && !myNomLockedIn && p.status !== "ELIMINATED" && !isPov;
          const showVoteBox = isVote && !myVoteLockedIn && p.status !== "ELIMINATED" && p.isNominee;

          // indicator slot (checks/POV/?/placement)
          let indicatorText = "";
          if (isCompleted && (place === 1 || place === 2 || place === 3)) {
            indicatorText = suffix(place);
          } else if (p.status === "ELIMINATED" && place) {
            indicatorText = suffix(place);
          } else if (isVote && myVoteLockedIn) {
            indicatorText = p.isNominee ? "❓" : (isPov ? "POV" : "✅");
          } else if (isNominate && myNomLockedIn) {
            indicatorText = isPov ? "POV" : "✅";
          } else {
            indicatorText = "";
          }

          const nomOn = nomSelected.includes(p.userId);
          const evictOn = evictSelected === p.userId;

          return (
            <div key={p.userId} style={{ width: tileW }}>
              <div
                style={{
                  width: tileW,
                  height: avatarH,
                  borderRadius: 6,
                  background: grayscale ? "#6f7781" : "#f5f7fa",
                  border: "1px solid rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  filter: grayscale ? "grayscale(1)" : "none",
                  opacity: grayscale ? 0.85 : 1,
                  position: "relative",
                }}
                title={p.username}
              >
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 18, opacity: 0.7 }}>
                  🙂
                </div>
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

              <div style={{ height: 16, marginTop: 2, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 1000 }}>
                {indicatorText}
              </div>

              <div style={{ height: 20, marginTop: 2, display: "grid", placeItems: "center" }}>
                {showNomBox ? (
                  <button
                    disabled={!canNomPick}
                    onClick={() => toggleNomPick(p.userId)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: nomOn ? "#111" : "#fff",
                      cursor: canNomPick ? "pointer" : "not-allowed",
                    }}
                    title="Select nominee"
                  />
                ) : showVoteBox ? (
                  <button
                    disabled={!canEvictPick}
                    onClick={() => toggleEvictPick(p.userId)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid rgba(0,0,0,0.35)",
                      background: evictOn ? "#111" : "#fff",
                      cursor: canEvictPick ? "pointer" : "not-allowed",
                    }}
                    title="Select to evict"
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
