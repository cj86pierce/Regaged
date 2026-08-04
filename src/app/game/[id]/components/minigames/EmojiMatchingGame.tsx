"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🍒", "🥝"];
const PAIRS = 6;

/** Flip-card matching. Submits raw timeMs + moves → Challenge Score. */
export default function EmojiMatchingGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [cards, setCards] = useState<{ emoji: string; id: number; flipped: boolean; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);
  const startAtRef = useRef(0);
  const timeMsRef = useRef(0);

  const initCards = useCallback(() => {
    const emojiPool = EMOJIS.slice(0, PAIRS);
    const doubled = [...emojiPool, ...emojiPool].map((e, i) => ({ emoji: e, id: i }));
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
    }
    return doubled.map((c, i) => ({
      emoji: c.emoji,
      id: i,
      flipped: false,
      matched: false,
    }));
  }, []);

  const start = useCallback(() => {
    if (!meUserId) return;
    setCards(initCards());
    setFlipped([]);
    setMoves(0);
    setMatchedCount(0);
    setPhase("play");
    setResult(null);
    setError(null);
    startAtRef.current = performance.now();
  }, [meUserId, initCards]);

  const flip = useCallback(
    (idx: number) => {
      if (phase !== "play" || busy) return;
      const c = cards[idx];
      if (c.flipped || c.matched || flipped.length >= 2) return;

      const next = cards.map((x, i) => (i === idx ? { ...x, flipped: true } : x));
      setCards(next);
      const newFlipped = [...flipped, idx];

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [a, b] = newFlipped;
        if (next[a].emoji === next[b].emoji) {
          setCards((prev) =>
            prev.map((x, i) => (i === a || i === b ? { ...x, matched: true } : x))
          );
          setMatchedCount((n) => n + 1);
          setFlipped([]);
        } else {
          setFlipped(newFlipped);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((x, i) => (i === a || i === b ? { ...x, flipped: false } : x))
            );
            setFlipped([]);
          }, 600);
        }
      } else {
        setFlipped(newFlipped);
      }
    },
    [cards, flipped, phase, busy]
  );

  useEffect(() => {
    if (phase === "play" && matchedCount === PAIRS) {
      timeMsRef.current = Math.round(performance.now() - startAtRef.current);
      setPhase("done");
    }
  }, [phase, matchedCount]);

  const submitScore = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const out = await submitMinigameScore({
        gameId,
        minigameId: "matching",
        raw: { timeMs: timeMsRef.current, moves },
      });
      setResult(out);
      onSubmitScore(out.challengeScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, meUserId, phase, moves, onSubmitScore]);

  if (!meUserId) {
    return (
      <MinigameShell title="Fruit Match" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell
      title="Fruit Match"
      blurb="Flip cards to find matching pairs. Faster = better score."
      myScore={myScore}
    >
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {cards.map((c, i) => (
            <button
              key={c.id}
              onClick={() => flip(i)}
              disabled={c.flipped || c.matched}
              style={{
                aspectRatio: 1,
                borderRadius: 8,
                border: "2px solid var(--border)",
                background: c.flipped || c.matched ? "var(--accent-bg)" : "var(--bg-msg)",
                fontSize: 24,
                cursor: c.flipped || c.matched ? "default" : "pointer",
                opacity: c.matched ? 0.6 : 1,
              }}
            >
              {c.flipped || c.matched ? c.emoji : "?"}
            </button>
          ))}
        </div>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            Done in {(timeMsRef.current / 1000).toFixed(2)}s · {moves} moves
          </div>
          {result && (
            <div style={{ fontSize: 12 }}>
              Score: <b>{result.challengeScore.toLocaleString()}</b>
              {result.improved ? " (new best!)" : " (kept previous best)"}
            </div>
          )}
          {error && <div style={{ color: "var(--text-error)", fontSize: 12 }}>{error}</div>}
          {!result && (
            <PlayButton onClick={submitScore} label={busy ? "Submitting…" : "Submit score"} disabled={busy} />
          )}
          {result && <PlayButton onClick={start} label="Play again" />}
        </div>
      )}
    </MinigameShell>
  );
}
