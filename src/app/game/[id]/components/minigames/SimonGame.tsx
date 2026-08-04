"use client";

import { useCallback, useRef, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const COLORS = [
  { id: 0, emoji: "🔴", bg: "#ef4444" },
  { id: 1, emoji: "🟢", bg: "#22c55e" },
  { id: 2, emoji: "🔵", bg: "#3b82f6" },
  { id: 3, emoji: "🟡", bg: "#eab308" },
];

/** Simon Says / Echo. */
export default function SimonGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "watch" | "input" | "done">("idle");
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);
  const inputIdx = useRef(0);
  const startRef = useRef(0);
  const levelRef = useRef(0);

  const flashSeq = useCallback(async (s: number[]) => {
    setPhase("watch");
    for (const step of s) {
      setLit(step);
      await new Promise((r) => setTimeout(r, 420));
      setLit(null);
      await new Promise((r) => setTimeout(r, 160));
    }
    inputIdx.current = 0;
    setPhase("input");
  }, []);

  const start = useCallback(() => {
    if (!meUserId) return;
    const first = [Math.floor(Math.random() * 4)];
    setSeq(first);
    setLevel(0);
    levelRef.current = 0;
    startRef.current = performance.now();
    setResult(null);
    setError(null);
    void flashSeq(first);
  }, [meUserId, flashSeq]);

  const press = useCallback(
    async (id: number) => {
      if (phase !== "input") return;
      setLit(id);
      setTimeout(() => setLit(null), 160);
      if (id !== seq[inputIdx.current]) {
        setPhase("done");
        return;
      }
      inputIdx.current += 1;
      if (inputIdx.current >= seq.length) {
        const nextLevel = seq.length;
        setLevel(nextLevel);
        levelRef.current = nextLevel;
        const next = [...seq, Math.floor(Math.random() * 4)];
        setSeq(next);
        await new Promise((r) => setTimeout(r, 450));
        void flashSeq(next);
      }
    },
    [phase, seq, flashSeq]
  );

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const residualMs = Math.max(0, Math.round(120_000 - (performance.now() - startRef.current)));
      const out = await submitMinigameScore({
        gameId,
        minigameId: "simon",
        raw: { level: levelRef.current, residualMs },
      });
      setResult(out);
      onSubmitScore(out.challengeScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, meUserId, phase, onSubmitScore]);

  if (!meUserId) {
    return (
      <MinigameShell title="Echo" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell title="Echo" blurb="Watch the sequence, then tap it back." myScore={myScore}>
      {phase === "idle" && <PlayButton onClick={start} />}

      {(phase === "watch" || phase === "input") && (
        <>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Level {level} · {phase === "watch" ? "Watch…" : "Your turn"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => press(c.id)}
                disabled={phase !== "input"}
                style={{
                  height: 72,
                  borderRadius: 12,
                  border: "2px solid var(--border)",
                  background: lit === c.id ? c.bg : "var(--bg-msg)",
                  fontSize: 28,
                  cursor: phase === "input" ? "pointer" : "default",
                  opacity: phase === "input" || lit === c.id ? 1 : 0.7,
                }}
              >
                {c.emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Reached level {level}</div>
          {result && (
            <div style={{ fontSize: 12 }}>
              Score: <b>{result.challengeScore.toLocaleString()}</b>
              {result.improved ? " (new best!)" : " (kept previous best)"}
            </div>
          )}
          {error && <div style={{ color: "var(--text-error)", fontSize: 12 }}>{error}</div>}
          {!result && <PlayButton onClick={submit} label={busy ? "Submitting…" : "Submit score"} disabled={busy} />}
          {result && <PlayButton onClick={start} label="Play again" />}
        </div>
      )}
    </MinigameShell>
  );
}
