"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const DURATION_MS = 30_000;

/** Click targets as they appear. */
export default function ReactionGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [target, setTarget] = useState<{ x: number; y: number; id: number } | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(DURATION_MS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);
  const startRef = useRef(0);
  const statsRef = useRef({ hits: 0, misses: 0 });
  const idRef = useRef(0);

  const spawn = useCallback(() => {
    setTarget({
      id: ++idRef.current,
      x: 8 + Math.random() * 76,
      y: 8 + Math.random() * 70,
    });
  }, []);

  const start = useCallback(() => {
    if (!meUserId) return;
    startRef.current = performance.now();
    statsRef.current = { hits: 0, misses: 0 };
    setHits(0);
    setMisses(0);
    setLeft(DURATION_MS);
    setPhase("play");
    setResult(null);
    setError(null);
    spawn();
  }, [meUserId, spawn]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      const remain = Math.max(0, DURATION_MS - elapsed);
      setLeft(remain);
      if (remain <= 0) setPhase("done");
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  const hit = useCallback(() => {
    if (phase !== "play") return;
    statsRef.current.hits += 1;
    setHits(statsRef.current.hits);
    spawn();
  }, [phase, spawn]);

  const miss = useCallback(() => {
    if (phase !== "play") return;
    statsRef.current.misses += 1;
    setMisses(statsRef.current.misses);
  }, [phase]);

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const residualMs = Math.max(0, Math.round(DURATION_MS - (performance.now() - startRef.current)));
      const out = await submitMinigameScore({
        gameId,
        minigameId: "reaction",
        raw: {
          hits: statsRef.current.hits,
          misses: statsRef.current.misses,
          residualMs,
        },
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
      <MinigameShell title="Quick Shot" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell title="Quick Shot" blurb="Click the targets. Misses hurt your score." myScore={myScore}>
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span>Hits {hits}</span>
            <span>Misses {misses}</span>
            <span>{Math.ceil(left / 1000)}s</span>
          </div>
          <div
            onClick={miss}
            style={{
              position: "relative",
              height: 220,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-msg)",
              overflow: "hidden",
              cursor: "crosshair",
            }}
          >
            {target && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hit();
                }}
                style={{
                  position: "absolute",
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  background: "#ef4444",
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                }}
              />
            )}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>
            {hits} hits · {misses} misses
          </div>
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
