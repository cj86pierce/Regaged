"use client";

import Link from "next/link";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  chatCount: number;
  plusCount: number;
  minusCount: number;
  povWins: number;
};

function trunc(name: string, max = 10) {
  if (name.length <= max) return name;
  return name.slice(0, max) + "…";
}

export default function PlayerStrip({
  players,
  povUserId,
}: {
  players: Player[];
  povUserId: string | null;
}) {
  return (
    <div
      style={{
        border: "1px solid #cfd7df",
        borderRadius: 10,
        padding: 8,
        background: "#eef7ff",
      }}
    >
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {players.map((p) => {
          const isPov = povUserId === p.userId;
          const eliminated = p.status === "ELIMINATED";
          const short = trunc(p.username, 10);

          return (
            <Link
              key={p.userId}
              href={`/u/${encodeURIComponent(p.username)}`}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
              title={p.username}
            >
              <div
                style={{
                  width: 72,
                  border: "1px solid #b9c4cf",
                  borderRadius: 6,
                  background: eliminated ? "#e9ecef" : "#ffffff",
                  opacity: eliminated ? 0.55 : 1,
                  padding: 6,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 6,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "linear-gradient(#f3f6f9, #fff)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    opacity: 0.7,
                    margin: "0 auto",
                  }}
                >
                  🙂
                </div>

                {isPov && (
                  <div
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: "#fff3cd",
                      border: "1px solid #e5c46a",
                      borderRadius: 999,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 1000,
                    }}
                  >
                    POV
                  </div>
                )}

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#0b5ed7",
                    textDecoration: "underline",
                    textAlign: "center",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {short}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
