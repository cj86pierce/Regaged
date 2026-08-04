"use client";

import { useState } from "react";

const GREEN_BUTTON = "linear-gradient(#a5d6a7, #66bb6a)";

export default function EnrollSurvivorPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameType: "SURVIVOR" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(json?.error ?? "Enroll failed");
    if (json?.gameId) window.location.href = `/game/${json.gameId}`;
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Survivor</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
        Yellow card + T$10. 20 castaways, 2 tribes of 10. Everyone plays the minigame — highest tribe
        total wins immunity; top scorer on the losing tribe is also immune. Equal competitors each
        round. Placements are only 1st (make merge) or 20th (voted out). At 10 left, 1sts move to a
        new merge lobby (two tribes).
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
