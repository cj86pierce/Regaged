"use client";

type Msg = { id: string; body: string; createdAt: string; isSystem: boolean };

export default function Sidebar(props: {
  gameState: string;
  roundNumber: number;

  nomSelected: string[];
  canConfirmNoms: boolean;
  onConfirmNoms: () => Promise<void>;
  myNomLockedIn: boolean;

  evictSelected: string | null;
  canConfirmVote: boolean;
  onConfirmVote: () => Promise<void>;
  myVoteLockedIn: string | null;

  // ✅ pass messages so Story can work
  messages?: Msg[];
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
    messages = [],
  } = props;

  const box: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
    maxHeight: 240,
    overflowY: "auto",
    wordBreak: "break-word",
  };

  const systemStory = messages
    .filter((m) => m.isSystem)
    .slice(0, 12)
    .map((m) => ({
      ...m,
      body: m.body.replace(/^\[SYSTEM\]\s*/i, ""),
    }));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Confirm box */}
      <div style={box}>
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
      <div style={box}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Read this</div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.35 }}>
          <b>Fasting:</b> POV is awarded first (immune). Pick 2 nominees. Then vote to evict one nominee.
          <br /><br />
          <b>State:</b> {gameState} · <b>Round:</b> {roundNumber}
        </div>
      </div>

      {/* Story */}
      <div style={box}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Story</div>
        {systemStory.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>No story yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {systemStory.map((m) => (
              <div key={m.id} style={{ fontSize: 12, background: "#fff3cd", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: 8 }}>
                <div style={{ fontWeight: 900, opacity: 0.8 }}>{new Date(m.createdAt).toLocaleString()}</div>
                <div style={{ marginTop: 4 }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
