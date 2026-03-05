"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SystemMessageRenderer from "@/components/chat/SystemMessageRenderer";

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

          if (sys) {
            return (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <SystemMessageRenderer
                  messageId={m.id}
                  body={m.body}
                  createdAt={m.createdAt}
                  meUserId={meUserId}
                />
              </div>
            );
          }

          // Normal message rendering
          const isMine = !!meUserId && m.userId === meUserId;
          const alreadyReacted = m.myReaction !== null;
          const disableReact = isMine || alreadyReacted;

          const net = m.plus - m.minus;
          const msgBg = isFlashing(m.id) ? "var(--bg-msg-system)" : "var(--bg-msg)";

          return (
            <div
              key={m.id}
              className="theme-chat-msg"
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
                <Link href={`/u/${encodeURIComponent(m.username)}`} className="theme-username" style={{ textDecoration: "underline" }}>
                  {m.username.length > 16 ? m.username.slice(0, 16) + "…" : m.username}
                </Link>
                <div style={{ opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ fontSize: 14, color: "var(--text-game)" }}>{m.body}</div>

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
