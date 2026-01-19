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

  async function claim(eventId: string, slotIndex: number) {
    setClaimErr(null);

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
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 8 }}>
        {messages.map((m) => {
          const dropId = parseDropId(m.body);
          const drop = dropId ? dropEvents[dropId] : null;

          // Drop message rendering
          if (dropId) {
            const claimed = !!drop?.claimedAt;

            return (
              <div
                key={m.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fff9b8",
                }}
              >
                <div style={{ fontWeight: 1000, marginBottom: 8 }}>
                  Drop {claimed ? <span style={{ fontSize: 12, opacity: 0.75 }}>(claimed)</span> : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {(drop?.options ?? []).map((o) => (
                    <button
                      key={o.slotIndex}
                      onClick={() => claim(dropId, o.slotIndex)}
                      disabled={claimed || !meUserId}
                      style={{
                        padding: "10px 0",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.18)",
                        background: claimed ? "#f3f6f9" : "#fff",
                        cursor: claimed ? "not-allowed" : "pointer",
                        fontSize: 18,
                      }}
                      title={o.kind}
                    >
                      {iconFor(o.kind)}
                    </button>
                  ))}
                </div>

                {!meUserId && <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Login to claim.</div>}
              </div>
            );
          }

          // Normal message
          return (
            <div
              key={m.id}
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12,
                padding: 10,
                background: m.isSystem ? "#fff9b8" : "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 1000 }}>{m.username}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>

              <div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 13 }}>{m.body}</div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  disabled={!meUserId || m.myReaction !== null}
                  onClick={() => onReact(m.id, "PLUS")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ✅
                </button>

                <button
                  disabled={!meUserId || m.myReaction !== null}
                  onClick={() => onReact(m.id, "MINUS")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ❌
                </button>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {m.plus - m.minus}
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
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
        >
          ◀ Prev
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Page <b>{page}</b> / {totalPages}
        </div>

        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
        >
          Next ▶
        </button>
      </div>

      {/* input */}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}
        />
        <button
          onClick={onSend}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "#111",
            color: "#fff",
            fontWeight: 1000,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
