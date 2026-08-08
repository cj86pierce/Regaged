"use client";

import { useState } from "react";

const GREEN_BUTTON = "linear-gradient(#a5d6a7, #66bb6a)";

export default function EnrollSurvivorBotPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameType: "SURVIVOR_BOT" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(json?.error ?? "Enroll failed");
    if (json?.gameId) window.location.href = `/game/${json.gameId}`;
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Survivor (Bot)</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
        Same Survivor rules on ~2 minute phases. Lobby waits 15 minutes for players, then bots fill empty seats. Practice — no payouts.
      </div>
      <button
        onClick={enroll}
        disabled={busy}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.14)",
          background: GREEN_BUTTON,
          color: "#1b3d1f",
          fontWeight: 1000,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Enrolling..." : "Enroll"}
      </button>
      {err && <div style={{ marginTop: 10, fontWeight: 900, color: "var(--text-error)" }}>{err}</div>}
    </main>
  );
}
