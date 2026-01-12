"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [flashUntil, setFlashUntil] = useState<Record<string, number>>({});

  useEffect(() => {
    if (page !== 1) return;

    const now = Date.now();
    const newlySeen: string[] = [];

    for (const m of messages) {
      if (!seenIdsRef.current.has(m.id)) {
        seenIdsRef.current.add(m.id);
        newlySeen.push(m.id);
      }
    }

    if (newlySeen.length === 0) return;

    setFlashUntil((cur) => {
      const next = { ...cur };
      for (const id of newlySeen) next[id] = now + 1500;
      return next;
    });

    const t = setTimeout(() => {
      setFlashUntil((cur) => {
        const cleaned: Record<string, number> = {};
        const now2 = Date.now();
        for (const [id, until] of Object.entries(cur)) {
          if (until > now2) cleaned[id] = until;
        }
        return cleaned;
      });
    }, 600);

    return () => clearTimeout(t);
  }, [messages, page]);

  const isFlashing = (id: string) => {
    const until = flashUntil[id];
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
      <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, background: "#fff", padding: 6 }}>
        {messages.map((m) => {
          const isMine = meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || m.isSystem || alreadyReacted;

          const points = m.plus - m.minus;
          const bodyText = m.body.replace(/^\[SYSTEM\]\s*/i, "");
          const bg = m.isSystem ? "#fff3cd" : isFlashing(m.id) ? "#fff3cd" : "#fff";

          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 120px",
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
                    pointerEvents: m.isSystem ? "none" : "auto",
                    opacity: m.isSystem ? 0.7 : 1,
                  }}
                >
                  {m.username.length > 16 ? m.username.slice(0, 16) + "…" : m.username}
                </Link>
                <div style={{ opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: 14, color: m.isSystem ? "#6c757d" : "#111" }}>
                {bodyText}
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
                      borderRadius: 6,
                      border: "1px solid rgba(0,0,0,0.18)",
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
                      borderRadius: 6,
                      border: "1px solid rgba(0,0,0,0.18)",
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
