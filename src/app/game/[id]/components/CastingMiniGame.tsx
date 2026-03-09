"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Reaction Time mini game. Lower stored score = worse (more likely to be nominated).
 * We store: 10000 - reactionMs, so faster click = higher score = safer.
 */
export default function CastingMiniGame(props: {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: () => void;
}) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "done">("idle");
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (!meUserId || phase !== "idle") return;
    setError(null);
    setPhase("wait");
    const delay = 2000 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
      timeoutRef.current = null;
    }, delay);
  }, [meUserId, phase]);

  const click = useCallback(async () => {
    if (phase !== "go") return;
    const ms = Math.round(performance.now() - goAtRef.current);
    setPhase("done");
    setResult(ms);
    // Store: 10000 - ms so lower stored score = worse (nominated)
    const score = Math.max(0, 10000 - ms);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${gameId}/casting/mini-game`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to submit");
      onSubmitScore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, phase, onSubmitScore]);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPhase("idle");
    setResult(null);
  }, []);

  if (!meUserId) {
    return (
      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Mini game</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </div>
    );
  }

  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Mini game</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
        Lower score = worse. 3 lowest become nominees at day end.
      </div>

      {phase === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12 }}>
            Your score: <b>{myScore > 0 ? myScore : "—"}</b>
          </div>
          <button
            onClick={start}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--accent-bg)",
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            Reaction test
          </button>
        </div>
      )}

      {phase === "wait" && (
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            background: "var(--bg-msg)",
            border: "2px solid var(--border)",
            textAlign: "center",
            cursor: "default",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>Wait for green…</div>
        </div>
      )}

      {phase === "go" && (
        <div
          onClick={click}
          style={{
            padding: 24,
            borderRadius: 10,
            background: "#22c55e",
            border: "2px solid #16a34a",
            textAlign: "center",
            cursor: "pointer",
            fontWeight: 1000,
            fontSize: 18,
          }}
        >
          Click!
        </div>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {result != null ? `${result} ms` : "—"}
          </div>
          {error && <div style={{ color: "crimson", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={reset}
              disabled={busy}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
