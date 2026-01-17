"use client";

import { useState } from "react";

export default function EnrollFastingPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameType: "FASTING" }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) return setErr(json?.error ?? "Enroll failed");

    const gameId = json?.gameId as string | undefined;
    if (gameId) window.location.href = `/game/${gameId}`;
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Fastings</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
        Quick game. POV first, then nominations, then eviction.
      </div>

      <button
        onClick={enroll}
        disabled={busy}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.14)",
          background: "linear-gradient(#ffd85a, #ffb703)",
          fontWeight: 1000,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Enrolling..." : "Enroll"}
      </button>

      {err && <div style={{ marginTop: 10, fontWeight: 900, color: "crimson" }}>{err}</div>}
    </main>
  );
}
