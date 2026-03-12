"use client";

import { useEffect, useMemo, useState } from "react";

type PlayerMini = { userId: string; username: string; status: "ACTIVE" | "ELIMINATED" };

type PmMsg = {
  id: string;
  createdAt: string;
  senderUserId: string;
  senderUsername: string;
  recipientUserId: string;
  recipientUsername: string;
  body: string;
};

export default function PmPanel({
  gameId,
  meUserId,
  players,
}: {
  gameId: string;
  meUserId: string | null;
  players: PlayerMini[];
}) {
  const [toUserId, setToUserId] = useState<string>("");
  const [messages, setMessages] = useState<PmMsg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const options = useMemo(() => {
    return players
      .filter((p) => p.userId !== meUserId)
      .map((p) => ({ value: p.userId, label: p.username }));
  }, [players, meUserId]);

  // choose a default recipient automatically
  useEffect(() => {
    if (!toUserId && options.length) setToUserId(options[0].value);
  }, [toUserId, options]);

  async function load() {
    if (!meUserId || !toUserId) return;
    const res = await fetch(`/api/game/${gameId}/pm?with=${encodeURIComponent(toUserId)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error ?? "Failed to load PMs");
      return;
    }
    setErr(null);
    setMessages(json.messages ?? []);
  }

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, toUserId, meUserId]);

  async function send() {
    if (!meUserId) return;
    if (!toUserId) return;
    if (text.trim().length < 1) return;

    setErr(null);
    const res = await fetch(`/api/game/${gameId}/pm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toUserId, text }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error ?? "Send failed");
      return;
    }
    setText("");
    await load();
  }

  if (!meUserId) {
    return <div className="theme-sidebar-panel" style={{ borderRadius: 10, padding: 12 }}>Login required.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="theme-sidebar-panel" style={{ borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>PM</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, alignItems: "center" }}>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="theme-chat-input"
            style={{ padding: 10, borderRadius: 10 }}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                Send to: {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={send}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "var(--bg-btn-send)",
              color: "var(--text-btn-send)",
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a private message…"
            className="theme-chat-input"
            style={{ flex: 1, padding: 10, borderRadius: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
        </div>

        {err && <div style={{ marginTop: 10, color: "var(--text-error)", fontWeight: 900 }}>{err}</div>}
      </div>

      <div className="theme-sidebar-panel" style={{ borderRadius: 10, padding: 10 }}>
        {messages.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No PMs yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.senderUserId === meUserId;
            return (
              <div
                key={m.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  background: mine ? "var(--bg-pm-mine)" : "var(--bg-card)",
                }}
              >
                <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.8, color: "var(--text-game)" }}>
                  {mine ? "You" : <span className="theme-username">{m.senderUsername}</span>} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 6, color: "var(--text-game)" }}>{m.body}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
