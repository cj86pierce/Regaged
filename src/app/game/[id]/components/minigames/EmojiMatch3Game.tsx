"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑"];
const ROWS = 6;
const COLS = 6;
const DURATION_MS = 90_000; // 1.5 minutes

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!;
}

/** Match-3 on a timer. Reshuffles when no moves remain. */
export default function EmojiMatch3Game(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [grid, setGrid] = useState<string[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(DURATION_MS);
  const [clearedTotal, setClearedTotal] = useState(0);
  const [cascadesTotal, setCascadesTotal] = useState(0);
  const [reshuffles, setReshuffles] = useState(0);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);
  const statsRef = useRef({ cleared: 0, cascades: 0 });
  const startRef = useRef(0);
  const endMsRef = useRef(0);

  const fillCell = useCallback((r: number, c: number, g: string[][]) => {
    let e: string;
    do {
      e = randomEmoji();
    } while (
      (r >= 2 && g[r - 1]![c] === e && g[r - 2]![c] === e) ||
      (c >= 2 && g[r]![c - 1] === e && g[r]![c - 2] === e)
    );
    return e;
  }, []);

  const initGrid = useCallback(() => {
    const g: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      g[r] = [];
      for (let c = 0; c < COLS; c++) {
        g[r]![c] = fillCell(r, c, g);
      }
    }
    return g;
  }, [fillCell]);

  const findMatches = useCallback((g: string[][]): Set<string> => {
    const matches = new Set<string>();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const e = g[r]![c];
        if (!e) continue;
        if (r >= 2 && g[r - 1]![c] === e && g[r - 2]![c] === e) {
          matches.add(`${r},${c}`).add(`${r - 1},${c}`).add(`${r - 2},${c}`);
        }
        if (c >= 2 && g[r]![c - 1] === e && g[r]![c - 2] === e) {
          matches.add(`${r},${c}`).add(`${r},${c - 1}`).add(`${r},${c - 2}`);
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
        if (next[r]![c]) {
          next[write]![c] = next[r]![c]!;
          if (write !== r) next[r]![c] = "";
          write--;
        }
      }
      while (write >= 0) {
        next[write]![c] = randomEmoji();
        write--;
      }
    }
    return next;
  }, []);

  const processMatches = useCallback(
    (g: string[][]) => {
      let total = 0;
      let cascades = 0;
      let current = g;
      let m = findMatches(current);
      while (m.size > 0) {
        cascades += 1;
        total += m.size;
        const next = current.map((row, r) =>
          row.map((cell, c) => (m.has(`${r},${c}`) ? "" : cell))
        );
        current = collapse(next);
        m = findMatches(current);
      }
      return { grid: current, cleared: total, cascades };
    },
    [findMatches, collapse]
  );

  /** True if any adjacent swap would create a match-3. */
  const hasPossibleMove = useCallback(
    (g: string[][]) => {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (c + 1 < COLS) {
            const trial = g.map((row) => [...row]);
            const tmp = trial[r]![c]!;
            trial[r]![c] = trial[r]![c + 1]!;
            trial[r]![c + 1] = tmp;
            if (findMatches(trial).size > 0) return true;
          }
          if (r + 1 < ROWS) {
            const trial = g.map((row) => [...row]);
            const tmp = trial[r]![c]!;
            trial[r]![c] = trial[r + 1]![c]!;
            trial[r + 1]![c] = tmp;
            if (findMatches(trial).size > 0) return true;
          }
        }
      }
      return false;
    },
    [findMatches]
  );

  const makePlayableBoard = useCallback(() => {
    for (let attempt = 0; attempt < 40; attempt++) {
      let g = initGrid();
      let { grid: g2, cleared } = processMatches(g);
      while (cleared > 0) {
        g = g2;
        const r = processMatches(g);
        g2 = r.grid;
        cleared = r.cleared;
      }
      if (hasPossibleMove(g2)) return g2;
    }
    // Fallback: return last attempt even if rare deadlock
    return initGrid();
  }, [initGrid, processMatches, hasPossibleMove]);

  const ensureMovesOrReshuffle = useCallback(
    (g: string[][]) => {
      if (hasPossibleMove(g)) return g;
      setReshuffles((n) => n + 1);
      return makePlayableBoard();
    },
    [hasPossibleMove, makePlayableBoard]
  );

  const start = useCallback(() => {
    if (!meUserId) return;
    const g = makePlayableBoard();
    setGrid(g);
    setSelected(null);
    setTimeLeftMs(DURATION_MS);
    setClearedTotal(0);
    setCascadesTotal(0);
    setReshuffles(0);
    statsRef.current = { cleared: 0, cascades: 0 };
    startRef.current = performance.now();
    endMsRef.current = 0;
    setPhase("play");
    setResult(null);
    setError(null);
  }, [meUserId, makePlayableBoard]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => {
      const remain = Math.max(0, DURATION_MS - (performance.now() - startRef.current));
      setTimeLeftMs(remain);
      if (remain <= 0) {
        endMsRef.current = 0;
        setPhase("done");
      }
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  const cellClick = useCallback(
    (r: number, c: number) => {
      if (phase !== "play" || !grid[r]?.[c]) return;
      if (!selected) {
        setSelected([r, c]);
        return;
      }
      const [sr, sc] = selected;
      const adj =
        (Math.abs(r - sr) === 1 && c === sc) || (Math.abs(c - sc) === 1 && r === sr);
      if (!adj) {
        setSelected([r, c]);
        return;
      }

      const swapped = grid.map((row) => [...row]);
      const tmp = swapped[r]![c]!;
      swapped[r]![c] = swapped[sr]![sc]!;
      swapped[sr]![sc] = tmp;

      const { grid: next, cleared, cascades } = processMatches(swapped);
      setSelected(null);

      // Invalid swap: revert board
      if (cleared === 0) return;

      const playable = ensureMovesOrReshuffle(next);
      setGrid(playable);
      setClearedTotal((s) => s + cleared);
      setCascadesTotal((s) => s + cascades);
      statsRef.current.cleared += cleared;
      statsRef.current.cascades += cascades;
    },
    [grid, phase, selected, processMatches, ensureMovesOrReshuffle]
  );

  const submitScore = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const leftoverMs = Math.max(
        0,
        Math.round(DURATION_MS - (performance.now() - startRef.current))
      );
      const out = await submitMinigameScore({
        gameId,
        minigameId: "match3",
        raw: {
          cleared: statsRef.current.cleared,
          cascades: statsRef.current.cascades,
          leftoverMs,
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
      <MinigameShell title="Candy Match" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  const secs = Math.ceil(timeLeftMs / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <MinigameShell
      title="Candy Match"
      blurb="Swap adjacent emojis to make 3+. 90 seconds — board reshuffles if you're stuck."
      myScore={myScore}
    >
      {phase === "idle" && <PlayButton onClick={start} />}

      {phase === "play" && grid.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
            <span>Time: <b>{clock}</b></span>
            <span>Cleared: {clearedTotal}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
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
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
            Cascades: {cascadesTotal}
            {reshuffles > 0 ? ` · Reshuffles: ${reshuffles}` : ""}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            Cleared {clearedTotal} · {cascadesTotal} cascades
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
