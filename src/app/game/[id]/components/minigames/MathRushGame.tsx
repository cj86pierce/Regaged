"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const DURATION_MS = 30_000;

function makeProblem() {
  const a = 2 + Math.floor(Math.random() * 12);
  const b = 2 + Math.floor(Math.random() * 12);
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)]!;
  let answer = 0;
  if (op === "+") answer = a + b;
  else if (op === "-") answer = a - b;
  else answer = a * b;
  return { text: `${a} ${op} ${b}`, answer };
}

/** Timed arithmetic blitz. */
export default function MathRushGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [problem, setProblem] = useState({ text: "", answer: 0 });
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [left, setLeft] = useState(DURATION_MS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);
  const startRef = useRef(0);
  const statsRef = useRef({ correct: 0, wrong: 0, maxStreak: 0 });
  const answerRef = useRef(0);

  const nextProblem = useCallback(() => {
    const p = makeProblem();
    setProblem(p);
    answerRef.current = p.answer;
    setInput("");
  }, []);

  const start = useCallback(() => {
    if (!meUserId) return;
    startRef.current = performance.now();
    statsRef.current = { correct: 0, wrong: 0, maxStreak: 0 };
    setCorrect(0);
    setWrong(0);
    setStreak(0);
    setMaxStreak(0);
    setLeft(DURATION_MS);
    setPhase("play");
    setResult(null);
    setError(null);
    nextProblem();
  }, [meUserId, nextProblem]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const remain = Math.max(0, DURATION_MS - (performance.now() - startRef.current));
      setLeft(remain);
      if (remain <= 0) setPhase("done");
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  const submitAnswer = useCallback(() => {
    if (phase !== "play") return;
    const n = Number(input.trim());
    if (!Number.isFinite(n)) return;
    if (n === answerRef.current) {
      statsRef.current.correct += 1;
      setCorrect(statsRef.current.correct);
      setStreak((s) => {
        const ns = s + 1;
        setMaxStreak((m) => {
          const mm = Math.max(m, ns);
          statsRef.current.maxStreak = mm;
          return mm;
        });
        return ns;
      });
    } else {
      statsRef.current.wrong += 1;
      setWrong(statsRef.current.wrong);
      setStreak(0);
    }
    nextProblem();
  }, [phase, input, nextProblem]);

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const residualMs = Math.max(0, Math.round(DURATION_MS - (performance.now() - startRef.current)));
      const out = await submitMinigameScore({
        gameId,
        minigameId: "mathrush",
        raw: {
          correct: statsRef.current.correct,
          wrong: statsRef.current.wrong,
          maxStreak: statsRef.current.maxStreak,
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
      <MinigameShell title="Brain Blitz" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell title="Brain Blitz" blurb="Solve as many as you can in 30 seconds." myScore={myScore}>
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span>✓ {correct}</span>
            <span>✗ {wrong}</span>
            <span>Streak {streak}</span>
            <span>{Math.ceil(left / 1000)}s</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 1000, textAlign: "center", margin: "12px 0" }}>
            {problem.text}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer();
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode="numeric"
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 18,
                fontWeight: 800,
              }}
            />
            <PlayButton onClick={submitAnswer} label="Go" />
          </form>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>
            {correct} correct · {wrong} wrong · best streak {maxStreak}
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
