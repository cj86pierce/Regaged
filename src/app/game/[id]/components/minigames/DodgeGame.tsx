"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const LANES = 3;
const MAX_MS = 60_000;

type Obstacle = { id: number; lane: number; y: number };

/** Lane dodge — survive as long as you can. */
export default function DodgeGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [survivedMs, setSurvivedMs] = useState(0);
  const [nearMisses, setNearMisses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);

  const startRef = useRef(0);
  const laneRef = useRef(1);
  const obsRef = useRef<Obstacle[]>([]);
  const nearRef = useRef(0);
  const idRef = useRef(0);
  const speedRef = useRef(0.35);

  const start = useCallback(() => {
    if (!meUserId) return;
    startRef.current = performance.now();
    laneRef.current = 1;
    obsRef.current = [];
    nearRef.current = 0;
    idRef.current = 0;
    speedRef.current = 0.35;
    setLane(1);
    setObstacles([]);
    setSurvivedMs(0);
    setNearMisses(0);
    setPhase("play");
    setResult(null);
    setError(null);
  }, [meUserId]);

  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;

    const tick = (t: number) => {
      const dt = Math.min(40, t - last);
      last = t;
      const elapsed = t - startRef.current;
      setSurvivedMs(Math.round(elapsed));
      speedRef.current = 0.35 + elapsed / 80_000;
      spawnAcc += dt;

      if (spawnAcc > Math.max(280, 700 - elapsed / 40)) {
        spawnAcc = 0;
        const o: Obstacle = {
          id: ++idRef.current,
          lane: Math.floor(Math.random() * LANES),
          y: -10,
        };
        obsRef.current = [...obsRef.current, o];
      }

      const next: Obstacle[] = [];
      let dead = false;
      for (const o of obsRef.current) {
        const y = o.y + speedRef.current * dt;
        if (y > 110) continue;
        // player at ~82%
        if (y > 74 && y < 92) {
          if (o.lane === laneRef.current) {
            dead = true;
          } else if (Math.abs(o.lane - laneRef.current) === 1 && y > 78 && y < 88) {
            nearRef.current += 1;
          }
        }
        next.push({ ...o, y });
      }
      obsRef.current = next;
      setObstacles(next);
      setNearMisses(nearRef.current);

      if (dead || elapsed >= MAX_MS) {
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "play") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a") {
        laneRef.current = Math.max(0, laneRef.current - 1);
        setLane(laneRef.current);
      }
      if (e.key === "ArrowRight" || e.key === "d") {
        laneRef.current = Math.min(LANES - 1, laneRef.current + 1);
        setLane(laneRef.current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const out = await submitMinigameScore({
        gameId,
        minigameId: "dodge",
        raw: { survivedMs, nearMisses: nearRef.current },
      });
      setResult(out);
      onSubmitScore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, meUserId, phase, survivedMs, onSubmitScore]);

  if (!meUserId) {
    return (
      <MinigameShell title="Lane Dash" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell
      title="Lane Dash"
      blurb="Arrow keys / A D or tap lanes. Dodge as long as you can."
      myScore={myScore}
    >
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span>{(survivedMs / 1000).toFixed(1)}s</span>
            <span>Near misses {nearMisses}</span>
          </div>
          <div
            style={{
              position: "relative",
              height: 240,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-msg)",
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: `repeat(${LANES}, 1fr)`,
            }}
          >
            {Array.from({ length: LANES }, (_, i) => (
              <button
                key={i}
                onClick={() => {
                  laneRef.current = i;
                  setLane(i);
                }}
                style={{
                  position: "relative",
                  border: "none",
                  borderLeft: i ? "1px solid var(--border)" : undefined,
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {obstacles
                  .filter((o) => o.lane === i)
                  .map((o) => (
                    <div
                      key={o.id}
                      style={{
                        position: "absolute",
                        left: "20%",
                        width: "60%",
                        height: 28,
                        top: `${o.y}%`,
                        borderRadius: 6,
                        background: "#64748b",
                        border: "1px solid var(--border)",
                      }}
                    />
                  ))}
                {lane === i && (
                  <div
                    style={{
                      position: "absolute",
                      left: "25%",
                      width: "50%",
                      height: 28,
                      top: "82%",
                      borderRadius: 8,
                      background: "#22c55e",
                      border: "2px solid #fff",
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>
            Survived {(survivedMs / 1000).toFixed(2)}s · {nearMisses} near misses
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
