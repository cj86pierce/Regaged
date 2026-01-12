"use client";

import Link from "next/link";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string | Date;
  eliminatedPlace: number | null;
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

export default function PlayerStrip({
  players,
  povUserId,
}: {
  players: Player[];
  povUserId: string | null;
}) {
  return (
    <div style={{ border: "1px solid #cfd7df", borderRadius: 10, padding: "6px 8px", background: "#eef7ff", overflow: "hidden" }}>
      {/* Fixed gap, no space-between = no weird shrinking */}
      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", justifyContent: "flex-start" }}>
        {players.map((p) => {
          const isPov = p.userId === povUserId;
          const eliminated = p.status === "ELIMINATED";
          const mins = minutesSince(p.lastActiveAt);

          return (
            <Link key={p.userId} href={`/u/${encodeURIComponent(p.username)}`} title={p.username} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                style={{
                  width: 64,
                  height: 128,
                  border: "1px solid #b9c4cf",
                  borderRadius: 6,
                  background: eliminated ? "#bfc5cc" : "#ffffff",
                  opacity: eliminated ? 0.85 : 1,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxSizing: "border-box",
                  padding: 3,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: eliminated ? "#a9b0b8" : "#f5f7fa",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 16, opacity: 0.6 }}>
                    🙂
                  </div>
                </div>

                {isPov && (
                  <div
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      background: "#fff3cd",
                      border: "1px solid #e5c46a",
                      borderRadius: 999,
                      padding: "2px 6px",
                      fontSize: 9,
                      fontWeight: 900,
                      zIndex: 2,
                    }}
                  >
                    POV
                  </div>
                )}

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#0b5ed7",
                    textDecoration: "underline",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {trunc(p.username, 10)}
                </div>

                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{mins} min</div>

                <div style={{ fontSize: 10, fontWeight: 900, marginTop: 2, opacity: 0.9 }}>
                  {p.eliminatedPlace ? suffix(p.eliminatedPlace) : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
