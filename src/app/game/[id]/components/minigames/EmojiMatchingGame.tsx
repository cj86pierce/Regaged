"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🍒", "🥝"];
const PAIRS = 6; // 12 cards

/** Flip-card matching. Score = 100000 - timeMs (higher = faster = better). */
export default function EmojiMatchingGame(props: {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: () => void;
}) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [cards, setCards] = useState<{ emoji: string; id: number; flipped: boolean; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startAtRef = useRef<number>(0);

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
    startAtRef.current = performance.now();
  }, [meUserId, initCards]);

  const flip = useCallback(
    (idx: number) => {
      if (phase !== "play" || busy) return;
      const c = cards[idx];
      if (c.flipped || c.matched || flipped.length >= 2) return;

      const next = cards.map((x, i) =>
        i === idx ? { ...x, flipped: true } : x
      );
      setCards(next);
      const newFlipped = [...flipped, idx];

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [a, b] = newFlipped;
        if (next[a].emoji === next[b].emoji) {
          setCards((prev) =>
            prev.map((x, i) =>
              i === a || i === b ? { ...x, matched: true } : x
            )
          );
          setMatchedCount((c) => c + 1);
          setFlipped([]);
        } else {
          setFlipped(newFlipped);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((x, i) =>
                i === a || i === b ? { ...x, flipped: false } : x
              )
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
      setPhase("done");
    }
  }, [phase, matchedCount]);

  const submitScore = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    const timeMs = Math.round(performance.now() - startAtRef.current);
    const score = Math.max(0, 100000 - timeMs);
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
  }, [gameId, meUserId, phase, onSubmitScore]);

  if (!meUserId) {
    return (
      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Match the pairs</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </div>
    );
  }

  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Match the emojis</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
        Flip cards to find matching pairs. Faster = better score.
      </div>

      {phase === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12 }}>
            Your score: <b>{myScore > 0 ? myScore.toLocaleString() : "—"}</b>
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
            Play
          </button>
        </div>
      )}

      {phase === "play" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
          }}
        >
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
            Done in {Math.round((performance.now() - startAtRef.current) / 1000)}s, {moves} moves!
          </div>
          {error && <div style={{ color: "var(--text-error)", fontSize: 12 }}>{error}</div>}
          <button
            onClick={submitScore}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--accent-bg)",
              fontWeight: 1000,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Submitting…" : "Submit score"}
          </button>
        </div>
      )}
    </div>
  );
}
