"use client";

import { useState } from "react";

export default function EnrollCastingPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameType: "CASTING" }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) return setErr(json?.error ?? "Enroll failed");

    const gameId = json?.gameId as string | undefined;
    if (gameId) window.location.href = `/game/${gameId}`;
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Castings</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
        12-hour days. Health decays if you don’t show up. Apples heal, poison hurts, keys win at the end.
      </div>

      <button
        onClick={enroll}
        disabled={busy}
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.14)",
          background: "linear-gradient(#eaf2ff, #d6e6ff)",
          fontWeight: 1000,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Enrolling..." : "Enroll"}
      </button>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        (Drops + health ticking will be added next — this step is just to fill/start Castings games.)
      </div>

      {err && <div style={{ marginTop: 10, fontWeight: 900, color: "var(--text-error)" }}>{err}</div>}
    </main>
  );
}
