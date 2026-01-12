"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

  nominees: any;
  nomineePlayers: any;
  voteInfo: any;
  myVoteLockedIn: any;
  votePick: any;
  setVotePick: any;
  submitVote: any;

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
    page,
    totalPages,
    setPage,
  } = props;

  const isNominate = gameState === "ROUND_NOMINATE";

  // NEW MESSAGE FLASH: keep a short-lived set of highlighted message IDs
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});

  useEffect(() => {
    // Only flash when viewing newest page
    if (page !== 1) return;

    const now = Date.now();
    const next: Record<string, number> = { ...flashIds };

    for (const m of messages) {
      // If message is new to our flash map, mark it for flashing for ~2.5s
      if (!next[m.id]) {
        next[m.id] = now + 2500;
      }
    }

    setFlashIds(next);

    const t = setTimeout(() => {
      setFlashIds((cur) => {
        const cleaned: Record<string, number> = {};
        const now2 = Date.now();
        for (const [id, until] of Object.entries(cur)) {
          if (until > now2) cleaned[id] = until;
        }
        return cleaned;
      });
    }, 600);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, page]);

  const invertBoxStyle = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 10,
    padding: 10,
    background: "linear-gradient(#111, #1d1d1d)",
    color: "#fff",
  } as const;

  const isFlashing = (id: string) => {
    const until = flashIds[id];
    return typeof until === "number" && until > Date.now();
  };

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
          Newest messages are on <b>Page 1</b>.
        </div>
      </div>

      {/* NOMINATIONS ONLY (black/inverted) */}
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

      {/* Pagination controls */}
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

      {/* Message feed */}
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff" }}>
        {messages.map((m) => {
          const isMine = meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || m.isSystem || alreadyReacted;

          const points = m.plus - m.minus;

          const isNomSummary = m.isSystem && /^(\[SYSTEM\]\s*)?Nomination votes:/i.test(m.body);
          const bodyText = m.body.replace(/^\[SYSTEM\]\s*/i, "");

          const bg =
            m.isSystem ? "#fff3cd" : isFlashing(m.id) ? "#fff3cd" : "#fff";

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 120px",
                gap: 10,
                padding: 10,
                borderBottom: "1px solid #eef2f5",
                background: bg,
                transition: "background 0.4s ease",
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
                {isNomSummary ? (
                  <NominationVoteLine text={bodyText} />
                ) : (
                  <div style={{ color: m.isSystem ? "#6c757d" : "#111" }}>{bodyText}</div>
                )}
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

function NominationVoteLine({ text }: { text: string }) {
  const parts = text.split("·").map((p) => p.trim());

  return (
    <div style={{ lineHeight: 1.4 }}>
      {parts.map((p, idx) => {
        const isBracket = p.startsWith("[") && p.endsWith("]");
        const clean = isBracket ? p.slice(1, -1) : p;

        return (
          <span key={idx} style={{ marginRight: 8 }}>
            {isBracket ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                }}
              >
                {clean}
              </span>
            ) : (
              <span style={{ fontWeight: 700 }}>{clean}</span>
            )}
            {idx < parts.length - 1 ? <span style={{ opacity: 0.5 }}> · </span> : null}
          </span>
        );
      })}
    </div>
  );
}
