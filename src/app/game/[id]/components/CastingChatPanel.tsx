"use client";

import { useState } from "react";
import Link from "next/link";
import SystemMessageRenderer, { parseDropId } from "@/components/chat/SystemMessageRenderer";

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

type DropEventsMap = Record<
  string,
  { eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }
>;

export default function CastingChatPanel(props: {
  gameId: string;
  meUserId: string | null;

  messages: Message[];
  dropEvents: DropEventsMap;

  chatText: string;
  setChatText: (v: string) => void;

  onSend: () => Promise<void>;
  onReact: (messageId: string, type: "PLUS" | "MINUS") => Promise<void>;

  page: number;
  totalPages: number;
  setPage: (n: number) => void;

  onReload: () => Promise<void>;
}) {
  const {
    gameId,
    meUserId,
    messages,
    dropEvents,
    chatText,
    setChatText,
    onSend,
    onReact,
    page,
    totalPages,
    setPage,
    onReload,
  } = props;

  const [claimErr, setClaimErr] = useState<string | null>(null);

  // ✅ prevent double send + double reacts
  const [sending, setSending] = useState(false);
  const [reacting, setReacting] = useState<Record<string, boolean>>({});
  const [claiming, setClaiming] = useState<Record<string, boolean>>({}); // eventId -> true

  async function safeSend() {
    if (!meUserId) return;
    if (sending) return;
    if (!chatText.trim()) return;

    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  }

  async function safeReact(messageId: string, type: "PLUS" | "MINUS") {
    if (!meUserId) return;
    if (reacting[messageId]) return;

    setReacting((p) => ({ ...p, [messageId]: true }));
    try {
      await onReact(messageId, type);
    } finally {
      setReacting((p) => ({ ...p, [messageId]: false }));
    }
  }

  async function claim(eventId: string, slotIndex: number) {
    if (!meUserId) return;
    if (claiming[eventId]) return;

    setClaimErr(null);
    setClaiming((p) => ({ ...p, [eventId]: true }));

    try {
      const res = await fetch(`/api/game/${gameId}/casting/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, slotIndex }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClaimErr(json?.error ?? "Claim failed");
        return;
      }

      await onReload();
    } finally {
      setClaiming((p) => ({ ...p, [eventId]: false }));
    }
  }

  return (
    <div>
      {/* input at top */}
      <div style={{ marginBottom: 10, display: "flex", gap: 8 }}>
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Type a message…"
          disabled={!meUserId || sending}
          className="theme-chat-input"
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 12,
            opacity: !meUserId ? 0.6 : 1,
          }}
        />
        <button
          onClick={safeSend}
          disabled={!meUserId || sending || !chatText.trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: sending ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
            color: sending ? "var(--text-primary)" : "var(--text-btn-send)",
            fontWeight: 1000,
            cursor: sending ? "not-allowed" : "pointer",
            opacity: !meUserId ? 0.6 : 1,
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      {/* messages */}
      <div style={{ display: "grid", gap: 8 }}>
        {messages.map((m, idx) => {
          const dropId = parseDropId(m.body);
          const drop = dropId ? dropEvents[dropId] : null;

          if (dropId || m.isSystem) {
            return (
              <SystemMessageRenderer
                key={m.id}
                messageId={m.id}
                body={m.body}
                createdAt={m.createdAt}
                dropEvent={drop ?? undefined}
                onClaim={claim}
                meUserId={meUserId}
                claiming={claiming}
              />
            );
          }

          // NORMAL message
          const busyReact = reacting[m.id] === true;

          const disableReact = !meUserId || m.myReaction !== null || busyReact;
          const net = m.plus - m.minus;
          const rowBg = idx % 2 === 0 ? "var(--bg-msg)" : "var(--bg-btn-disabled)";

          return (
            <div
              key={m.id}
              className={m.isSystem ? "theme-chat-msg-sys" : "theme-chat-msg"}
              style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, background: rowBg }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <Link href={`/u/${encodeURIComponent(m.username.toLowerCase())}`} className="theme-username" style={{ fontWeight: 800 }}>{m.username}</Link>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>

              <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text-game)" }}>{m.body}</div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 1000 }}>{net >= 0 ? `+${net}` : `${net}`} points</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      disabled={disableReact}
                      onClick={() => safeReact(m.id, "PLUS")}
                      title="Plus"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        cursor: disableReact ? "not-allowed" : "pointer",
                        opacity: disableReact ? 0.6 : 1,
                      }}
                    >
                      ✅
                    </button>
                    <button
                      disabled={disableReact}
                      onClick={() => safeReact(m.id, "MINUS")}
                      title="Minus"
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-card)",
                        cursor: disableReact ? "not-allowed" : "pointer",
                        opacity: disableReact ? 0.6 : 1,
                      }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {claimErr && <div style={{ marginTop: 10, color: "var(--text-error)", fontWeight: 1000 }}>{claimErr}</div>}

      {/* pager */}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="theme-pager-btn"
          style={{ padding: "6px 10px", borderRadius: 10 }}
        >
          ◀ Prev
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }} className="theme-text-secondary">
          Page <b>{page}</b> / {totalPages}
        </div>

        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="theme-pager-btn"
          style={{ padding: "6px 10px", borderRadius: 10 }}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
