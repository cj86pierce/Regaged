"use client";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  chatCount: number;
  plusCount: number;
  minusCount: number;
  povWins: number;
};

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
        padding: 10,
        background: "#eef7ff",
      }}
    >
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {players.map((p) => {
          const isPov = povUserId === p.userId;
          const eliminated = p.status === "ELIMINATED";

          return (
            <div key={p.userId} style={{ minWidth: 96, textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto",
                  borderRadius: 6,
                  border: "1px solid #b9c4cf",
                  background: eliminated ? "#e9ecef" : "#ffffff",
                  position: "relative",
                  opacity: eliminated ? 0.55 : 1,
                }}
                title={p.username}
              >
                {/* placeholder avatar */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    opacity: 0.35,
                  }}
                >
                  🙂
                </div>

                {isPov && (
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      background: "#fff3cd",
                      border: "1px solid #e5c46a",
                      borderRadius: 999,
                      padding: "2px 6px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    POV
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, marginTop: 6, color: "#0b5ed7", textDecoration: "underline" }}>
                {p.username}
              </div>

              <div style={{ fontSize: 11, opacity: 0.8 }}>
                ✅{p.plusCount} ❌{p.minusCount}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
