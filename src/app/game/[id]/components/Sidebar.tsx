"use client";

type Player = { userId: string; username: string };

export default function Sidebar(props: {
  gameState: string;
  roundNumber: number;

  // Nominate confirm
  nomSelected: string[];
  canConfirmNoms: boolean;
  onConfirmNoms: () => Promise<void>;
  myNomLockedIn: boolean;

  // Vote confirm
  evictSelected: string | null;
  canConfirmVote: boolean;
  onConfirmVote: () => Promise<void>;
  myVoteLockedIn: string | null;
}) {
  const {
    gameState,
    roundNumber,
    nomSelected,
    canConfirmNoms,
    onConfirmNoms,
    myNomLockedIn,
    evictSelected,
    canConfirmVote,
    onConfirmVote,
    myVoteLockedIn,
  } = props;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Confirm box */}
      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>
          {gameState === "ROUND_NOMINATE" ? "Confirm Nominations" : gameState === "ROUND_VOTE" ? "Confirm Vote" : "Round"}
        </div>

        {gameState === "ROUND_NOMINATE" && (
          <>
            {myNomLockedIn ? (
              <div style={{ fontWeight: 1000, color: "#198754" }}>✅ Nominations locked in.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  Selected: <b>{nomSelected.length}/2</b>
                </div>
                <button
                  disabled={!canConfirmNoms}
                  onClick={onConfirmNoms}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: canConfirmNoms ? "#111" : "#f3f6f9",
                    color: canConfirmNoms ? "#fff" : "#111",
                    fontWeight: 1000,
                    cursor: canConfirmNoms ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm Nominations
                </button>
              </>
            )}
          </>
        )}

        {gameState === "ROUND_VOTE" && (
          <>
            {myVoteLockedIn ? (
              <div style={{ fontWeight: 1000, color: "#198754" }}>✅ Vote locked in.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  Selected evict: <b>{evictSelected ? "1/1" : "0/1"}</b>
                </div>
                <button
                  disabled={!canConfirmVote}
                  onClick={onConfirmVote}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: canConfirmVote ? "#111" : "#f3f6f9",
                    color: canConfirmVote ? "#fff" : "#111",
                    fontWeight: 1000,
                    cursor: canConfirmVote ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm Vote
                </button>
              </>
            )}
          </>
        )}

        {(gameState !== "ROUND_NOMINATE" && gameState !== "ROUND_VOTE") && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            State: <b>{gameState}</b> · Round <b>{roundNumber}</b>
          </div>
        )}
      </div>

      {/* Read this */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Read this</div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.35 }}>
          <b>Fasting:</b> POV is awarded first (immune). Pick 2 nominees. Then vote to evict one nominee.
          <br />
          <br />
          <b>State:</b> {gameState} · <b>Round:</b> {roundNumber}
        </div>
      </div>
    </div>
  );
}
