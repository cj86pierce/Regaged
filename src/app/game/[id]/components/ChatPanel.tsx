"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type SysRow = { name: string; points: number; tag: string };

function parseSystemRows(body: string): { kind: "NOM" | "EVICT"; rows: SysRow[] } | null {
  if (body.startsWith("[SYSTEM:NOM_VOTES]")) {
    const lines = body.split("\n").slice(1).filter(Boolean);
    const rows = lines.map((ln) => {
      const [name, pts, tag] = ln.split("|");
      return { name: name ?? "?", points: Number(pts ?? "0"), tag: tag ?? "" };
    });
    return { kind: "NOM", rows };
  }

  if (body.startsWith("[SYSTEM:EVICT_VOTES]")) {
    const lines = body.split("\n").slice(1).filter(Boolean);
    const rows = lines.map((ln) => {
      const [name, pts, tag] = ln.split("|");
      return { name: name ?? "?", points: Number(pts ?? "0"), tag: tag ?? "" };
    });
    return { kind: "EVICT", rows };
  }

  return null;
}

export default function ChatPanel(props: {
  meUserId: string | null;
  messages: Message[];

  chatText: string;
  setChatText: (t: string) => void;
  onSend: () => Promise<void>;
  onReact: (messageId: string, type: "PLUS" | "MINUS") => Promise<void>;

  page: number;
  totalPages: number;
  setPage: (p: number) => void;
}) {
  const { meUserId, messages, chatText, setChatText, onSend, onReact, page, totalPages, setPage } = props;

  // highlight only truly new messages
  const gameKey = useMemo(() => {
    if (typeof window === "undefined") return "regaged:lastSeenMsg:unknown";
    const parts = window.location.pathname.split("/").filter(Boolean);
    const id = parts[0] === "game" && parts[1] ? parts[1] : "unknown";
    return `regaged:lastSeenMsg:${id}`;
  }, []);

  const [flashUntil, setFlashUntil] = useState<Record<string, number>>({});

  useEffect(() => {
    if (page !== 1) return;
    if (!messages.length) return;

    const topId = messages[0].id;
    const prevTop = sessionStorage.getItem(gameKey);

    if (!prevTop) {
      sessionStorage.setItem(gameKey, topId);
      return;
    }
    if (prevTop === topId) return;

    const newIds: string[] = [];
    for (const m of messages) {
      if (m.id === prevTop) break;
      newIds.push(m.id);
    }
    sessionStorage.setItem(gameKey, topId);

    if (!newIds.length) return;

    const now = Date.now();
    setFlashUntil((cur) => {
      const next = { ...cur };
      for (const id of newIds) next[id] = now + 900;
      return next;
    });

    const t = setTimeout(() => {
      setFlashUntil((cur) => {
        const cleaned: Record<string, number> = {};
        const now2 = Date.now();
        for (const [id, until] of Object.entries(cur)) if (until > now2) cleaned[id] = until;
        return cleaned;
      });
    }, 700);

    return () => clearTimeout(t);
  }, [messages, page, gameKey]);

  const isFlashing = (id: string) => {
    const until = flashUntil[id];
    return typeof until === "number" && until > Date.now();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Input */}
      <div className="theme-chat-wrap">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Write a message…"
            className="theme-chat-input"
            style={{ flex: 1, padding: 10, borderRadius: 10 }}
          />
          <button
            onClick={onSend}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--accent-bg)",
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Pagination */}
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

      {/* Feed */}
      <div className="theme-chat-feed">
        {messages.map((m) => {
          const sys = m.isSystem;
          const sysParsed = sys ? parseSystemRows(m.body) : null;

          // System blocks are already yellow; normal new messages flash once.
          const msgBg = sys || isFlashing(m.id) ? "var(--bg-msg-system)" : "var(--bg-msg)";

          // ✅ System vote blocks (compact + titled)
          if (sysParsed) {
            const title = sysParsed.kind === "NOM" ? "Nomination votes" : "Eviction votes";

            return (
              <div
                key={m.id}
                className="theme-chat-msg-sys"
                style={{
                  padding: 8,
                  marginBottom: 6,
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 10,
                  background: "var(--bg-msg-system)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 1000, fontSize: 12 }}>{title}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString()}</div>
                </div>

                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {sysParsed.rows.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 62px 52px",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 6px",
                        borderRadius: 8,
                        background: "var(--bg-msg)",
                      }}
                    >
                      <div className="theme-username" style={{ fontSize: 12 }}>
                        {r.name}
                      </div>

                      <div style={{ fontSize: 11 }}>
                        <span style={{ fontWeight: 900 }}>{r.points}</span> pts
                      </div>

                      <div style={{ justifySelf: "end" }}>
                        {r.tag ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "#111",
                              color: "#ffeb3b",
                              fontWeight: 1000,
                              fontSize: 11,
                            }}
                          >
                            {r.tag}
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Normal message rendering (includes POV system message as a normal yellow system message)
          const isMine = !!meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || sys || alreadyReacted;

          const net = m.plus - m.minus;

          // System messages look like normal chat but yellow + no reactions
          const authorLabel = sys ? "SYSTEM" : m.username;

          return (
            <div
              key={m.id}
              className={sys ? "theme-chat-msg-sys" : "theme-chat-msg"}
              style={{
                display: "grid",
                gridTemplateColumns: "170px 1fr 90px",
                gap: 10,
                padding: 10,
                marginBottom: 6,
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: msgBg,
                transition: "background 0.35s ease",
              }}
            >
              <div style={{ fontSize: 12 }}>
                {sys ? (
                  <div style={{ fontWeight: 1000, color: "var(--text-game)" }}>{authorLabel}</div>
                ) : (
                  <Link href={`/u/${encodeURIComponent(m.username)}`} className="theme-username" style={{ textDecoration: "underline" }}>
                    {m.username.length > 16 ? m.username.slice(0, 16) + "…" : m.username}
                  </Link>
                )}
                <div style={{ opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: 14, color: "var(--text-game)" }}>
                {m.body.replace(/^\[SYSTEM\]\s*/i, "")}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.85 }}>
                  {net >= 0 ? `+${net}` : `${net}`}
                </div>

                <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button disabled={disableReact} onClick={() => onReact(m.id, "PLUS")} title={disableReact ? "Locked" : "✅ +1"}>
                    ✅
                  </button>
                  <button disabled={disableReact} onClick={() => onReact(m.id, "MINUS")} title={disableReact ? "Locked" : "❌ -1"}>
                    ❌
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
