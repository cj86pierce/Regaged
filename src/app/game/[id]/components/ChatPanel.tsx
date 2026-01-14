"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

  // determine gameId from URL for sessionStorage key
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

    const topId = messages[0].id; // newest message id (you fetch desc)
    const prevTop = sessionStorage.getItem(gameKey);

    // first time on this game page: store and do NOT flash
    if (!prevTop) {
      sessionStorage.setItem(gameKey, topId);
      return;
    }

    if (prevTop === topId) return;

    // find all new message ids until we reach the old top
    const newIds: string[] = [];
    for (const m of messages) {
      if (m.id === prevTop) break;
      newIds.push(m.id);
    }

    // update stored top id
    sessionStorage.setItem(gameKey, topId);

    if (newIds.length === 0) return;

    const now = Date.now();
    setFlashUntil((cur) => {
      const next = { ...cur };
      for (const id of newIds) next[id] = now + 1200;
      return next;
    });

    const t = setTimeout(() => {
      setFlashUntil((cur) => {
        const cleaned: Record<string, number> = {};
        const now2 = Date.now();
        for (const [id, until] of Object.entries(cur)) if (until > now2) cleaned[id] = until;
        return cleaned;
      });
    }, 900);

    return () => clearTimeout(t);
  }, [messages, page, gameKey]);

  const isFlashing = (id: string) => {
    const until = flashUntil[id];
    return typeof until === "number" && until > Date.now();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
      </div>

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

      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 6 }}>
        {messages.map((m) => {
          const sys = m.isSystem;
          const sysParsed = sys ? parseSystemRows(m.body) : null;

          // Only flash non-system messages (system messages are already yellow)
          const bg = sys ? "#fff3cd" : isFlashing(m.id) ? "#fff3cd" : "#fff";

          // System row-style rendering
          if (sysParsed) {
            return (
              <div
                key={m.id}
                style={{
                  padding: 10,
                  marginBottom: 6,
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 10,
                  background: "#fff3cd",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                  {new Date(m.createdAt).toLocaleString()}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {sysParsed.rows.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 70px 60px",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.55)",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: "#0b5ed7" }}>{r.name}</div>

                      <div style={{ justifySelf: "start", fontSize: 12 }}>
                        <span style={{ fontWeight: 900 }}>{r.points}</span> points
                      </div>

                      <div style={{ justifySelf: "end" }}>
                        {r.tag ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
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

          const isMine = !!meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || sys || alreadyReacted;

          const net = m.plus - m.minus;
          const bodyText = m.body.replace(/^\[SYSTEM\]\s*/i, "");

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "170px 1fr 90px",
                gap: 10,
                padding: 10,
                marginBottom: 6,
                border: "1px solid rgba(0,0,0,0.18)",
                borderRadius: 10,
                background: bg,
                transition: "background 0.35s ease",
              }}
            >
              <div style={{ fontSize: 12 }}>
                <Link
                  href={`/u/${encodeURIComponent(m.username)}`}
                  style={{
                    color: "#0b5ed7",
                    textDecoration: "underline",
                    fontWeight: 900,
                  }}
                >
                  {m.username.length > 16 ? m.username.slice(0, 16) + "…" : m.username}
                </Link>
                <div style={{ opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: 14, color: "#111" }}>{bodyText}</div>

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
