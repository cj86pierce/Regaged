"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑"];
const ROWS = 6;
const COLS = 6;
const MOVES = 15;

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

/** Match-3 style. Swap adjacent to make 3+. Score = total cleared (higher = better). */
export default function EmojiMatch3Game(props: {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: () => void;
}) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [grid, setGrid] = useState<string[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [movesLeft, setMovesLeft] = useState(MOVES);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<string[][]>([]);

  const fillCell = useCallback((r: number, c: number, g: string[][]) => {
    let e: string;
    do {
      e = randomEmoji();
    } while (
      (r >= 2 && g[r - 1][c] === e && g[r - 2][c] === e) ||
      (c >= 2 && g[r][c - 1] === e && g[r][c - 2] === e)
    );
    return e;
  }, []);

  const initGrid = useCallback(() => {
    const g: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      g[r] = [];
      for (let c = 0; c < COLS; c++) {
        g[r][c] = fillCell(r, c, g);
      }
    }
    return g;
  }, [fillCell]);

  const findMatches = useCallback((g: string[][]): Set<string> => {
    const matches = new Set<string>();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const e = g[r][c];
        if (!e) continue;
        const key = (x: number, y: number) => `${x},${y}`;
        if (r >= 2 && g[r - 1][c] === e && g[r - 2][c] === e) {
          matches.add(key(r, c)).add(key(r - 1, c)).add(key(r - 2, c));
        }
        if (c >= 2 && g[r][c - 1] === e && g[r][c - 2] === e) {
          matches.add(key(r, c)).add(key(r, c - 1)).add(key(r, c - 2));
        }
      }
    }
    return matches;
  }, []);

  const collapse = useCallback((g: string[][]): string[][] => {
    const next = g.map((row) => [...row]);
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (next[r][c]) {
          next[write][c] = next[r][c];
          if (write !== r) next[r][c] = "";
          write--;
        }
      }
      while (write >= 0) {
        next[write][c] = randomEmoji();
        write--;
      }
    }
    return next;
  }, []);

  const processMatches = useCallback((g: string[][]) => {
    let total = 0;
    let current = g;
    let m = findMatches(current);
    while (m.size > 0) {
      total += m.size;
      const next = current.map((row, r) =>
        row.map((cell, c) => (m.has(`${r},${c}`) ? "" : cell))
      );
      current = collapse(next);
      m = findMatches(current);
    }
    return { grid: current, cleared: total };
  }, [findMatches, collapse]);

  const start = useCallback(() => {
    if (!meUserId) return;
    let g = initGrid();
    let { grid: g2, cleared } = processMatches(g);
    while (cleared > 0) {
      g = g2;
      const r = processMatches(g);
      g2 = r.grid;
      cleared = r.cleared;
    }
    gridRef.current = g2;
    setGrid(g2);
    setSelected(null);
    setMovesLeft(MOVES);
    setScore(0);
    setPhase("play");
  }, [meUserId, initGrid, processMatches]);

  const cellClick = useCallback(
    (r: number, c: number) => {
      if (phase !== "play" || !grid[r]?.[c]) return;
      if (selected) {
        const [sr, sc] = selected;
        const adj =
          (Math.abs(r - sr) === 1 && c === sc) || (Math.abs(c - sc) === 1 && r === sr);
        if (!adj) {
          setSelected([r, c]);
          return;
        }
        const g = grid.map((row) => [...row]);
        [g[r][c], g[sr][sc]] = [g[sr][sc], g[r][c]];
        const { grid: next, cleared } = processMatches(g);
        setGrid(next);
        gridRef.current = next;
        setSelected(null);
        setMovesLeft((m) => m - 1);
        setScore((s) => s + cleared);
        if (cleared === 0) {
          setGrid(g);
          gridRef.current = g;
        }
      } else {
        setSelected([r, c]);
      }
    },
    [grid, phase, selected, processMatches]
  );

  const submitScore = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
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
  }, [gameId, meUserId, phase, score, onSubmitScore]);

  useEffect(() => {
    if (phase === "play" && movesLeft <= 0) setPhase("done");
  }, [phase, movesLeft]);

  if (!meUserId) {
    return (
      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Match 3</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </div>
    );
  }

  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Match 3</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
        Swap adjacent emojis to make 3+ in a row. More matches = better score.
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
            Play
          </button>
        </div>
      )}

      {phase === "play" && grid.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
            <span>Moves: {movesLeft}</span>
            <span>Score: {score}</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 4,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const sel = selected && selected[0] === r && selected[1] === c;
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => cellClick(r, c)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 6,
                      border: sel ? "2px solid #22c55e" : "1px solid var(--border)",
                      background: sel ? "var(--accent-bg)" : "var(--bg-msg)",
                      fontSize: 20,
                      cursor: "pointer",
                    }}
                  >
                    {cell || ""}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            Final score: {score}
          </div>
          {error && <div style={{ color: "crimson", fontSize: 12 }}>{error}</div>}
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
