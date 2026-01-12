"use client";

type Message = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  plus: number;
  minus: number;
  myReaction: "PLUS" | "MINUS" | null;
};

type Player = {
  userId: string;
  username: string;
};

export default function Sidebar(props: {
  gameId: string;
  gameState: string;
  roundNumber: number;
  messages: Message[];

  nominees: { a: string; b: string; evictedUserId: string | null } | null;
  nomineePlayers: Player[];
  myVoteLockedIn: string | null;
  votePick: string | null;
  setVotePick: (id: string | null) => void;
  submitVote: () => Promise<void>;
}) {
  const { gameState, roundNumber, messages, nominees, nomineePlayers, myVoteLockedIn, votePick, setVotePick, submitVote } =
    props;

  const systemFeed = messages
    .filter((m) => m.username === "__system__" || m.body.startsWith("[SYSTEM]"))
    .map((m) => ({
      id: m.id,
      text: m.body.replace(/^\[SYSTEM\]\s*/i, ""),
      createdAt: m.createdAt,
    }))
    .slice(0, 20);

  const showVoteBox = gameState === "ROUND_VOTE" && nominees;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Vote box ABOVE Read this */}
      {showVoteBox && (
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 10, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 1000, marginBottom: 8 }}>Vote to Evict</div>

          {myVoteLockedIn ? (
            <div style={{ fontWeight: 900, color: "#198754" }}>✅ Vote locked in.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {nomineePlayers.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => setVotePick(p.userId)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: votePick === p.userId ? "#0b5ed7" : "#f3f6f9",
                      color: votePick === p.userId ? "#fff" : "#111",
                      cursor: "pointer",
                      fontWeight: 1000,
                    }}
                    title={p.username}
                  >
                    Evict {p.username.length > 14 ? p.username.slice(0, 14) + "…" : p.username}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={submitVote}
                  disabled={!votePick}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: votePick ? "linear-gradient(#ffd85a, #ffb703)" : "#f3f6f9",
                    cursor: votePick ? "pointer" : "not-allowed",
                    fontWeight: 1000,
                  }}
                >
                  Submit Vote
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Read this */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Read this</div>

        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.35 }}>
          <b>Fasting (Big Brother – fast):</b>
          <br />
          • A POV is awarded each round (POV is immune).
          <br />
          • Everyone nominates 2 players (can’t nominate POV).
          <br />
          • Top 2 become nominees (ties: less active is nominated).
          <br />
          • Everyone except nominees votes to evict.
          <br />
          • Repeat until the game ends.
          <br />
          <br />
          <b>State:</b> {gameState} · <b>Round:</b> {roundNumber}
        </div>
      </div>

      {/* Game Story */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Game Story</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>
          {systemFeed.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No story yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {systemFeed.map((s) => (
                <div key={s.id} style={{ paddingBottom: 8, borderBottom: "1px solid #eef2f5" }}>
                  <div style={{ color: "#0b5ed7", fontWeight: 900 }}>{s.text}</div>
                  <div style={{ opacity: 0.6 }}>{new Date(s.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
