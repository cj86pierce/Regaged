"use client";

import { useEffect, useMemo, useState } from "react";

type StatePayload = {
  ok: boolean;
  game: { id: string; state: string; roundNumber: number; stateEndsAt: string | null; povUserId: string | null };
  players: { userId: string; username: string; status: string; chatCount: number; plusCount: number; minusCount: number; povWins: number }[];
  messages: { id: string; userId: string; username: string; body: string; createdAt: string; plus: number; minus: number }[];
};

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const [data, setData] = useState<StatePayload | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/game/${gameId}/state`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error ?? "Failed to load game");
    setData(j);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const timeLeft = useMemo(() => {
    if (!data?.game?.stateEndsAt) return null;
    const ms = new Date(data.game.stateEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data]);

  async function send() {
    setErr(null);
    const r = await fetch(`/api/game/${gameId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j?.error ?? "Send failed");
      return;
    }
    setText("");
    await load();
  }

  async function react(messageId: string, type: "PLUS" | "MINUS") {
    const r = await fetch(`/api/game/message/${messageId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const j = await r.json();
    if (!r.ok) setErr(j?.error ?? "React failed");
    else await load();
  }

  return (
    <main>
      <h1>Fasting Game</h1>
      <div style={{ opacity: 0.85 }}>
        State: <b>{data?.game?.state ?? "..."}</b> | Round: <b>{data?.game?.roundNumber ?? "..."}</b>
        {timeLeft !== null && <> | Ends in: <b>{timeLeft}s</b></>}
      </div>

      <h3 style={{ marginTop: 16 }}>Players</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(data?.players ?? []).map((p) => (
          <div key={p.userId} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, minWidth: 140 }}>
            <div className="theme-username" style={{ fontWeight: 700 }}>{p.username}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              ✅ {p.plusCount} | ❌ {p.minusCount} | 💬 {p.chatCount} | POV {p.povWins}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 16 }}>Public Chat</h3>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, height: 320, overflow: "auto" }}>
        {(data?.messages ?? []).map((m) => (
          <div key={m.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
            <div>
              <b className="theme-username">{m.username}</b>: {m.body}
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, marginTop: 2 }}>
              <button onClick={() => react(m.id, "PLUS")}>✅ {m.plus}</button>
              <button onClick={() => react(m.id, "MINUS")}>❌ {m.minus}</button>
              <span style={{ opacity: 0.7 }}>{new Date(m.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={send} style={{ padding: "8px 14px" }}>Send</button>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 10 }}><b>{err}</b></p>}

      <p style={{ marginTop: 10, opacity: 0.75 }}>
        Chat cooldown is 5 seconds. Reactions are one per user per message.
      </p>
    </main>
  );
}
