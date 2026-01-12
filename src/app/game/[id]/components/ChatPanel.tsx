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

export default function ChatPanel(props: {
  gameId: string;
  meUserId: string | null;

  messages: Message[];

  chatText: string;
  setChatText: (t: string) => void;
  onSend: () => Promise<void>;
  onReact: (messageId: string, type: "PLUS" | "MINUS") => Promise<void>;

  // Nominations
  gameState: string;
  povUserId: string | null;
  players: Player[];
  myNomLockedIn: boolean;
  nomPicks: string[];
  toggleNom: (userId: string) => void;
  submitNoms: () => Promise<void>;

  // Voting
  nominees: { a: string; b: string; evictedUserId: string | null } | null;
  nomineePlayers: Player[];
  voteInfo:
    | {
        nomineeAUserId: string;
        nomineeBUserId: string;
        votesA: number;
        votesB: number;
        myVoteTargetUserId: string | null;
      }
    | null;
  myVoteLockedIn: string | null;
  votePick: string | null;
  setVotePick: (id: string | null) => void;
  submitVote: () => Promise<void>;
}) {
  const {
    meUserId,
    messages,
    chatText,
    setChatText,
    onSend,
    onReact,

    gameState,
    povUserId,
    players,
    myNomLockedIn,
    nomPicks,
    toggleNom,
    submitNoms,

    nominees,
    nomineePlayers,
    voteInfo,
    myVoteLockedIn,
    votePick,
    setVotePick,
    submitVote,
  } = props;

  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Nomination or Vote box */}
      {isNominate && (
        <div style={{ border: "1px solid #d7d7d7", borderRadius: 8, padding: 10, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Nominate 2 players</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>POV holder is immune.</div>

          {myNomLockedIn ? (
            <div style={{ fontWeight: 800, color: "#198754" }}>✅ Nominations locked in.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {players
                  .filter((p) => p.status === "ACTIVE")
                  .filter((p) => p.userId !== povUserId)
                  .map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => toggleNom(p.userId)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cfd7df",
                        background: nomPicks.includes(p.userId) ? "#d1e7dd" : "#f7f9fb",
                        cursor: "pointer",
                      }}
                    >
                      {p.username}
                    </button>
                  ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={submitNoms}
                  disabled={nomPicks.length !== 2}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid #cfd7df",
                    background: nomPicks.length === 2 ? "#eaf2ff" : "#f3f6f9",
                    cursor: nomPicks.length === 2 ? "pointer" : "not-allowed",
                    fontWeight: 800,
                  }}
                >
                  Submit nominations
                </button>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Selected {nomPicks.length}/2</span>
              </div>
            </>
          )}
        </div>
      )}

      {isVote && (
        <div style={{ border: "1px solid #d7d7d7", borderRadius: 8, padding: 10, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Vote to Evict</div>

          {!nominees ? (
            <div style={{ opacity: 0.75 }}>Waiting for nominees…</div>
          ) : (
            <>
              {voteInfo && (
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                  Current votes:{" "}
                  <b>
                    {(nomineePlayers.find((p) => p.userId === voteInfo.nomineeAUserId)?.username ?? "A")}: {voteInfo.votesA}{" "}
                    | {(nomineePlayers.find((p) => p.userId === voteInfo.nomineeBUserId)?.username ?? "B")}: {voteInfo.votesB}
                  </b>
                </div>
              )}

              {myVoteLockedIn ? (
                <div style={{ fontWeight: 800, color: "#198754" }}>✅ Vote locked in.</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {nomineePlayers.map((p) => (
                      <button
                        key={p.userId}
                        onClick={() => setVotePick(p.userId)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #cfd7df",
                          background: votePick === p.userId ? "#cfe2ff" : "#f7f9fb",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Evict {p.username}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={submitVote}
                      disabled={!votePick}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: "1px solid #cfd7df",
                        background: votePick ? "#eaf2ff" : "#f3f6f9",
                        cursor: votePick ? "pointer" : "not-allowed",
                        fontWeight: 800,
                      }}
                    >
                      Submit vote
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat list */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 8, background: "#fff" }}>
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {messages.map((m) => {
            const isMine = meUserId && m.userId === meUserId;
            const isSystem = m.username === "__system__";
            const alreadyReacted = m.myReaction !== null;
            const disableReact = isMine || isSystem || alreadyReacted;

            const points = m.plus - m.minus;

            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 120px", gap: 10, padding: 10, borderBottom: "1px solid #eef2f5" }}>
                {/* left meta */}
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "#0b5ed7", textDecoration: "underline", fontWeight: 800 }}>
                    {m.username}
                  </div>
                  <div style={{ opacity: 0.6 }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* message */}
                <div style={{ fontSize: 14 }}>
                  <div style={{ color: isSystem ? "#6c757d" : "#111" }}>{m.body}</div>
                </div>

                {/* right points + reactions */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    +{points} points
                  </div>

                  <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button
                      disabled={disableReact}
                      onClick={() => onReact(m.id, "PLUS")}
                      style={{
                        width: 26,
                        height: 22,
                        borderRadius: 4,
                        border: "1px solid #cfd7df",
                        background: disableReact ? "#f3f6f9" : "#ffffff",
                        cursor: disableReact ? "not-allowed" : "pointer",
                      }}
                      title={isSystem ? "Can't react to system" : isMine ? "Can't react to your own message" : alreadyReacted ? "Already reacted" : "Check"}
                    >
                      ✅
                    </button>

                    <button
                      disabled={disableReact}
                      onClick={() => onReact(m.id, "MINUS")}
                      style={{
                        width: 26,
                        height: 22,
                        borderRadius: 4,
                        border: "1px solid #cfd7df",
                        background: disableReact ? "#f3f6f9" : "#ffffff",
                        cursor: disableReact ? "not-allowed" : "pointer",
                      }}
                      title={isSystem ? "Can't react to system" : isMine ? "Can't react to your own message" : alreadyReacted ? "Already reacted" : "X"}
                    >
                      ❌
                    </button>
                  </div>

                  <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75 }}>
                    ✅ {m.plus} · ❌ {m.minus}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* input */}
        <div style={{ display: "flex", gap: 8, padding: 10 }}>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Write a message…"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cfd7df" }}
          />
          <button
            onClick={onSend}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cfd7df",
              background: "#eaf2ff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
