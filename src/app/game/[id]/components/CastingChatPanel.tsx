"use client";

import { useState } from "react";

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

function parseDropId(body: string) {
  const m = /^\[CASTDROP:([a-z0-9]+)\]$/i.exec((body ?? "").trim());
  return m ? m[1] : null;
}

function iconFor(kind: "APPLE" | "KEY" | "POISON") {
  if (kind === "APPLE") return "🍎";
  if (kind === "KEY") return "🔑";
  return "🧪";
}

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
        {messages.map((m) => {
          const dropId = parseDropId(m.body);
          const drop = dropId ? dropEvents[dropId] : null;

          // DROP message
          if (dropId) {
            const claimed = !!drop?.claimedAt;
            const busy = claiming[dropId] === true;

            return (
              <div key={m.id} className="theme-chat-msg-sys" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 1000, marginBottom: 8 }}>
                  Drop {claimed ? <span style={{ fontSize: 12, opacity: 0.75 }}>(claimed)</span> : null}
                </div>

                {claimed ? (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>This drop was claimed.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                    {(drop?.options ?? []).map((o) => (
                      <button
                        key={o.slotIndex}
                        onClick={() => claim(dropId, o.slotIndex)}
                        disabled={!meUserId || busy}
                        style={{
                          padding: "10px 0",
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: busy ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                          cursor: busy ? "not-allowed" : "pointer",
                          fontSize: 18,
                        }}
                        title={o.kind}
                      >
                        {iconFor(o.kind)}
                      </button>
                    ))}
                  </div>
                )}

                {!meUserId && !claimed && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Login to claim.</div>
                )}
                {busy && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Claiming...</div>}
              </div>
            );
          }

          // NORMAL message
          const busyReact = reacting[m.id] === true;

          return (
            <div
              key={m.id}
              className={m.isSystem ? "theme-chat-msg-sys" : "theme-chat-msg"}
              style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 1000 }}>{m.username}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>

              <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: 13 }}>{m.body}</div>

                {/* reactions on the right, horizontal ✅ ❌ */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    disabled={!meUserId || m.myReaction !== null || busyReact}
                    onClick={() => safeReact(m.id, "PLUS")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: busyReact ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                      cursor: busyReact ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      minWidth: 44,
                      opacity: !meUserId ? 0.6 : 1,
                    }}
                    title="Plus"
                  >
                    ✅
                  </button>

                  <button
                    disabled={!meUserId || m.myReaction !== null || busyReact}
                    onClick={() => safeReact(m.id, "MINUS")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: busyReact ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                      cursor: busyReact ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      minWidth: 44,
                      opacity: !meUserId ? 0.6 : 1,
                    }}
                    title="Minus"
                  >
                    ❌
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>{m.plus - m.minus}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {claimErr && <div style={{ marginTop: 10, color: "crimson", fontWeight: 1000 }}>{claimErr}</div>}

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
