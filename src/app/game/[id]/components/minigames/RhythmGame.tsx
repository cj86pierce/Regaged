"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const LANES = 4;
const DURATION_MS = 35_000;
const NOTE_TRAVEL_MS = 1400;
const HIT_WINDOW_MS = 140;
const KEYS = ["a", "s", "d", "f"];

type Note = { id: number; lane: number; hitAt: number; hit?: "perfect" | "good" | "miss" };

/** Guitar-Hero lite: falling notes, tap lanes. */
export default function RhythmGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [now, setNow] = useState(0);
  const [points, setPoints] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);

  const startRef = useRef(0);
  const notesRef = useRef<Note[]>([]);
  const [, bump] = useState(0);
  const statsRef = useRef({ points: 0, maxCombo: 0 });

  const start = useCallback(() => {
    if (!meUserId) return;
    const t0 = performance.now();
    startRef.current = t0;
    const notes: Note[] = [];
    let id = 0;
    for (let t = 900; t < DURATION_MS - 400; t += 380 + Math.floor(Math.random() * 220)) {
      notes.push({ id: id++, lane: Math.floor(Math.random() * LANES), hitAt: t0 + t });
      if (Math.random() < 0.25) {
        notes.push({
          id: id++,
          lane: Math.floor(Math.random() * LANES),
          hitAt: t0 + t + 90,
        });
      }
    }
    notesRef.current = notes;
    statsRef.current = { points: 0, maxCombo: 0 };
    setPoints(0);
    setCombo(0);
    setMaxCombo(0);
    setPhase("play");
    setResult(null);
    setError(null);
    setNow(t0);
  }, [meUserId]);

  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      // Auto-miss notes that passed the window
      let comboNow = combo;
      let changed = false;
      for (const n of notesRef.current) {
        if (!n.hit && t > n.hitAt + HIT_WINDOW_MS) {
          n.hit = "miss";
          comboNow = 0;
          changed = true;
        }
      }
      if (changed) {
        setCombo(0);
        bump((x) => x + 1);
      }
      if (t - startRef.current >= DURATION_MS) {
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const hitLane = useCallback(
    (lane: number) => {
      if (phase !== "play") return;
      const t = performance.now();
      const candidates = notesRef.current
        .filter((n) => n.lane === lane && !n.hit)
        .map((n) => ({ n, d: Math.abs(n.hitAt - t) }))
        .filter((x) => x.d <= HIT_WINDOW_MS)
        .sort((a, b) => a.d - b.d);
      if (!candidates.length) {
        setCombo(0);
        return;
      }
      const { n, d } = candidates[0]!;
      const quality = d <= 50 ? "perfect" : "good";
      n.hit = quality;
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => {
          const mm = Math.max(m, next);
          statsRef.current.maxCombo = mm;
          return mm;
        });
        const add = (quality === "perfect" ? 120 : 70) * (1 + Math.floor(next / 5));
        setPoints((p) => {
          const np = p + add;
          statsRef.current.points = np;
          return np;
        });
        return next;
      });
      bump((x) => x + 1);
    },
    [phase]
  );

  useEffect(() => {
    if (phase !== "play") return;
    function onKey(e: KeyboardEvent) {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) {
        e.preventDefault();
        hitLane(i);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, hitLane]);

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const residualMs = Math.max(0, DURATION_MS - Math.round(performance.now() - startRef.current));
      const out = await submitMinigameScore({
        gameId,
        minigameId: "rhythm",
        raw: {
          points: statsRef.current.points,
          maxCombo: statsRef.current.maxCombo,
          residualMs,
        },
      });
      setResult(out);
      onSubmitScore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, meUserId, phase, onSubmitScore]);

  if (!meUserId) {
    return (
      <MinigameShell title="Beat Tap" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  const elapsed = now - startRef.current;

  return (
    <MinigameShell
      title="Beat Tap"
      blurb="Tap A S D F (or the pads) when notes hit the line."
      myScore={myScore}
    >
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span>Pts {points}</span>
            <span>Combo {combo}</span>
            <span>{Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000))}s</span>
          </div>
          <div
            style={{
              position: "relative",
              height: 220,
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              background: "var(--bg-msg)",
              display: "grid",
              gridTemplateColumns: `repeat(${LANES}, 1fr)`,
            }}
          >
            {Array.from({ length: LANES }, (_, lane) => (
              <div key={lane} style={{ position: "relative", borderLeft: lane ? "1px solid var(--border)" : undefined }}>
                {notesRef.current
                  .filter((n) => n.lane === lane && !n.hit)
                  .map((n) => {
                    const progress = 1 - (n.hitAt - now) / NOTE_TRAVEL_MS;
                    if (progress < -0.1 || progress > 1.2) return null;
                    return (
                      <div
                        key={n.id}
                        style={{
                          position: "absolute",
                          left: "15%",
                          width: "70%",
                          height: 18,
                          borderRadius: 6,
                          background: "var(--accent-bg)",
                          border: "1px solid var(--border)",
                          top: `${Math.min(100, Math.max(0, progress * 100))}%`,
                          transform: "translateY(-50%)",
                        }}
                      />
                    );
                  })}
                <div
                  style={{
                    position: "absolute",
                    left: 4,
                    right: 4,
                    bottom: 36,
                    height: 4,
                    background: "rgba(34,197,94,0.8)",
                    borderRadius: 2,
                  }}
                />
                <button
                  onClick={() => hitLane(lane)}
                  style={{
                    position: "absolute",
                    left: 6,
                    right: 6,
                    bottom: 6,
                    height: 28,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    fontWeight: 900,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  {KEYS[lane]!.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>
            {points} pts · max combo {maxCombo}
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
