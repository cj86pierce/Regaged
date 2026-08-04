"use client";

import { useCallback, useMemo, useState } from "react";
import MinigameShell, { PlayButton } from "./MinigameShell";
import { submitMinigameScore, type MinigameProps } from "./types";

const PRIZES = [
  1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000, 25000, 50000, 75000, 100000,
  200000, 300000, 400000, 500000, 750000, 1000000,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Phase = "idle" | "pickCase" | "open" | "offer" | "done";

/** Deal or No Deal — final cash drives Challenge Score. */
export default function DealOrNoDealGame(props: MinigameProps) {
  const { gameId, meUserId, myScore, onSubmitScore } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [cases, setCases] = useState<{ id: number; prize: number; open: boolean }[]>([]);
  const [myCase, setMyCase] = useState<number | null>(null);
  const [toOpen, setToOpen] = useState(0);
  const [offer, setOffer] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [finalCash, setFinalCash] = useState(0);
  const [beatBanker, setBeatBanker] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ challengeScore: number; improved: boolean } | null>(null);

  const remaining = useMemo(() => cases.filter((c) => !c.open && c.id !== myCase), [cases, myCase]);
  const remainingPrizes = useMemo(() => {
    const prizes = cases.filter((c) => !c.open).map((c) => c.prize);
    return prizes.sort((a, b) => a - b);
  }, [cases]);

  const start = useCallback(() => {
    if (!meUserId) return;
    const prizes = shuffle(PRIZES);
    setCases(prizes.map((prize, id) => ({ id, prize, open: false })));
    setMyCase(null);
    setToOpen(0);
    setOffer(0);
    setRounds(0);
    setFinalCash(0);
    setBeatBanker(0);
    setPhase("pickCase");
    setResult(null);
    setError(null);
  }, [meUserId]);

  const bankerOffer = useCallback((closedPrizes: number[], round: number) => {
    const avg = closedPrizes.reduce((s, p) => s + p, 0) / Math.max(1, closedPrizes.length);
    const pressure = 0.35 + Math.min(0.55, round * 0.07);
    return Math.round(avg * pressure);
  }, []);

  const afterOpenCheck = useCallback(
    (nextCases: { id: number; prize: number; open: boolean }[], mine: number, openedThisRound: number, round: number) => {
      const stillClosed = nextCases.filter((c) => !c.open);
      if (stillClosed.length <= 2) {
        // Reveal your case vs last
        const minePrize = nextCases.find((c) => c.id === mine)?.prize ?? 0;
        setFinalCash(minePrize);
        setBeatBanker(minePrize > offer ? 1 : 0);
        setPhase("done");
        return;
      }
      if (openedThisRound <= 0) {
        const closedPrizes = stillClosed.map((c) => c.prize);
        const o = bankerOffer(closedPrizes, round);
        setOffer(o);
        setPhase("offer");
        return;
      }
      setToOpen(openedThisRound);
      setPhase("open");
    },
    [bankerOffer, offer]
  );

  const pickMyCase = useCallback(
    (id: number) => {
      if (phase !== "pickCase") return;
      setMyCase(id);
      setRounds(1);
      setToOpen(6);
      setPhase("open");
    },
    [phase]
  );

  const openCase = useCallback(
    (id: number) => {
      if (phase !== "open" || myCase == null || id === myCase) return;
      const target = cases.find((c) => c.id === id);
      if (!target || target.open) return;
      const next = cases.map((c) => (c.id === id ? { ...c, open: true } : c));
      setCases(next);
      const left = toOpen - 1;
      afterOpenCheck(next, myCase, left, rounds);
    },
    [phase, myCase, cases, toOpen, rounds, afterOpenCheck]
  );

  const acceptDeal = useCallback(() => {
    setFinalCash(offer);
    const minePrize = cases.find((c) => c.id === myCase)?.prize ?? 0;
    setBeatBanker(offer >= minePrize ? 1 : 0);
    setPhase("done");
  }, [offer, cases, myCase]);

  const noDeal = useCallback(() => {
    const nextRound = rounds + 1;
    setRounds(nextRound);
    const schedule = [5, 4, 3, 2, 1, 1, 1];
    const openCount = schedule[Math.min(schedule.length - 1, nextRound - 1)] ?? 1;
    setToOpen(openCount);
    setPhase("open");
  }, [rounds]);

  const submit = useCallback(async () => {
    if (!meUserId || phase !== "done") return;
    setBusy(true);
    setError(null);
    try {
      const out = await submitMinigameScore({
        gameId,
        minigameId: "deal",
        raw: { finalCash, roundsPlayed: rounds, beatBanker },
      });
      setResult(out);
      onSubmitScore(out.challengeScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [gameId, meUserId, phase, finalCash, rounds, beatBanker, onSubmitScore]);

  if (!meUserId) {
    return (
      <MinigameShell title="Deal or No Deal" blurb="Log in to play." myScore={myScore}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Log in to play.</div>
      </MinigameShell>
    );
  }

  return (
    <MinigameShell
      title="Deal or No Deal"
      blurb="Pick a case, open others, and decide when the banker calls."
      myScore={myScore}
    >
      {phase === "idle" && <PlayButton onClick={start} />}

      {(phase === "pickCase" || phase === "open" || phase === "offer") && (
        <>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            {phase === "pickCase" && "Pick your case."}
            {phase === "open" && `Open ${toOpen} more case${toOpen === 1 ? "" : "s"}.`}
            {phase === "offer" && (
              <>
                Banker offers <b>${offer.toLocaleString()}</b> — Deal or No Deal?
              </>
            )}
            {myCase != null && phase !== "pickCase" && (
              <span style={{ marginLeft: 8, opacity: 0.75 }}>Your case: #{myCase + 1}</span>
            )}
          </div>

          {phase === "offer" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <PlayButton onClick={acceptDeal} label="DEAL" />
              <PlayButton onClick={noDeal} label="NO DEAL" />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 10 }}>
            {cases.map((c) => {
              const isMine = c.id === myCase;
              const disabled =
                c.open ||
                (phase === "pickCase" ? false : phase === "open" ? isMine : true);
              return (
                <button
                  key={c.id}
                  disabled={disabled || phase === "offer"}
                  onClick={() => (phase === "pickCase" ? pickMyCase(c.id) : openCase(c.id))}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: isMine ? "2px solid #22c55e" : "1px solid var(--border)",
                    background: c.open ? "transparent" : "var(--accent-bg)",
                    fontSize: 11,
                    fontWeight: 800,
                    opacity: c.open ? 0.55 : 1,
                    cursor: disabled || phase === "offer" ? "default" : "pointer",
                  }}
                >
                  {c.open ? `$${c.prize.toLocaleString()}` : `#${c.id + 1}`}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 10, opacity: 0.7, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {remainingPrizes.map((p) => (
              <span key={p} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px" }}>
                ${p.toLocaleString()}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
            Cases left (not yours): {remaining.length}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>You walk away with ${finalCash.toLocaleString()}</div>
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
