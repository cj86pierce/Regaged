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

type Message = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  plus: number;
  minus: number;
  myReaction: "PLUS" | "MINUS" | null;
  isSystem: boolean;
};

export default function ChatPanel(props: {
  gameId: string;
  meUserId: string | null;

  messages: Message[];

  chatText: string;
  setChatText: (t: string) => void;
  onSend: () => Promise<void>;
  onReact: (messageId: string, type: "PLUS" | "MINUS") => Promise<void>;

  gameState: string;
  povUserId: string | null;
  players: Player[];
  myNomLockedIn: boolean;
  nomPicks: string[];
  toggleNom: (userId: string) => void;
  submitNoms: () => Promise<void>;

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

  // pagination from page.tsx
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
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

    page,
    totalPages,
    setPage,
  } = props;

  const isNominate = gameState === "ROUND_NOMINATE";
  const isVote = gameState === "ROUND_VOTE";

  const invertBoxStyle = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 10,
    padding: 10,
    background: "linear-gradient(#111, #1d1d1d)",
    color: "#fff",
  } as const;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Input at TOP */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Write a message…"
            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #cfd7df" }}
          />
          <button
            onClick={onSend}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "#eaf2ff",
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          Tip: newest messages are on <b>Page 1</b>.
        </div>
      </div>

      {/* NOMS / VOTE boxes - inverted */}
      {isNominate && (
        <div style={invertBoxStyle}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Nominate 2 players</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
            POV is immune this round.
          </div>

          {myNomLockedIn ? (
            <div style={{ fontWeight: 900, color: "#7CFF7C" }}>✅ Nominations locked in.</div>
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
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: nomPicks.includes(p.userId) ? "#2a7f44" : "rgba(255,255,255,0.08)",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title={p.username}
                    >
                      {p.username.length > 12 ? p.username.slice(0, 12) + "…" : p.username}
                    </button>
                  ))}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={submitNoms}
                  disabled={nomPicks.length !== 2}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.20)",
                    background: nomPicks.length === 2 ? "#ffd85a" : "rgba(255,255,255,0.10)",
                    color: nomPicks.length === 2 ? "#2b2000" : "#fff",
                    cursor: nomPicks.length === 2 ? "pointer" : "not-allowed",
                    fontWeight: 1000,
                  }}
                >
                  Submit
                </button>
                <span style={{ fontSize: 12, opacity: 0.85 }}>Selected {nomPicks.length}/2</span>
              </div>
            </>
          )}
        </div>
      )}

      {isVote && (
        <div style={invertBoxStyle}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Vote to Evict</div>

          {!nominees ? (
            <div style={{ opacity: 0.85 }}>Waiting for nominees…</div>
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
                <div style={{ fontWeight: 900, color: "#7CFF7C" }}>✅ Vote locked in.</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {nomineePlayers.map((p) => (
                      <button
                        key={p.userId}
                        onClick={() => setVotePick(p.userId)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: votePick === p.userId ? "#0b5ed7" : "rgba(255,255,255,0.08)",
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 1000,
                        }}
                      >
                        Evict {p.username.length > 12 ? p.username.slice(0, 12) + "…" : p.username}
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
                        border: "1px solid rgba(255,255,255,0.20)",
                        background: votePick ? "#ffd85a" : "rgba(255,255,255,0.10)",
                        color: votePick ? "#2b2000" : "#fff",
                        cursor: votePick ? "pointer" : "not-allowed",
                        fontWeight: 1000,
                      }}
                    >
                      Submit
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Pagination controls (no scroll list) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Page <b>{page}</b> / {totalPages} (Page 1 = newest)
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button disabled={page <= 1} onClick={() => setPage(1)}>Newest</button>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>◀</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>▶</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Oldest</button>
        </div>
      </div>

      {/* Message feed (newest first, no scroll container) */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff" }}>
        {messages.map((m) => {
          const isMine = meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || m.isSystem || alreadyReacted;

          const points = m.plus - m.minus;

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 120px",
                gap: 10,
                padding: 10,
                borderBottom: "1px solid #eef2f5",
                background: m.isSystem ? "#fff3cd" : "#fff",
              }}
            >
              <div style={{ fontSize: 12 }}>
                <Link
                  href={`/u/${encodeURIComponent(m.username)}`}
                  style={{
                    color: "#0b5ed7",
                    textDecoration: "underline",
                    fontWeight: 900,
                    pointerEvents: m.isSystem ? "none" : "auto",
                    opacity: m.isSystem ? 0.7 : 1,
                  }}
                >
                  {m.username.length > 16 ? m.username.slice(0, 16) + "…" : m.username}
                </Link>
                <div style={{ opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: 14 }}>
                <div style={{ color: m.isSystem ? "#6c757d" : "#111" }}>
                  {m.body}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>+{points} points</div>

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
    </div>
  );
}
