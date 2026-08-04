"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getMinigameDef, isMinigameId, type MinigameId } from "@/lib/minigames/registry";
import EmojiMatchingGame from "@/app/game/[id]/components/minigames/EmojiMatchingGame";
import EmojiMatch3Game from "@/app/game/[id]/components/minigames/EmojiMatch3Game";
import RhythmGame from "@/app/game/[id]/components/minigames/RhythmGame";
import DealOrNoDealGame from "@/app/game/[id]/components/minigames/DealOrNoDealGame";
import SimonGame from "@/app/game/[id]/components/minigames/SimonGame";
import ReactionGame from "@/app/game/[id]/components/minigames/ReactionGame";
import MathRushGame from "@/app/game/[id]/components/minigames/MathRushGame";
import DodgeGame from "@/app/game/[id]/components/minigames/DodgeGame";
import type { MinigameProps } from "@/app/game/[id]/components/minigames/types";

function renderGame(id: MinigameId, props: MinigameProps) {
  switch (id) {
    case "matching":
      return <EmojiMatchingGame {...props} />;
    case "match3":
      return <EmojiMatch3Game {...props} />;
    case "rhythm":
      return <RhythmGame {...props} />;
    case "deal":
      return <DealOrNoDealGame {...props} />;
    case "simon":
      return <SimonGame {...props} />;
    case "reaction":
      return <ReactionGame {...props} />;
    case "mathrush":
      return <MathRushGame {...props} />;
    case "dodge":
      return <DodgeGame {...props} />;
    default:
      return null;
  }
}

export default function ArcadePlayPage() {
  const params = useParams();
  const rawId = params.id as string;
  const minigameId = isMinigameId(rawId) ? rawId : null;

  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [tMoney, setTMoney] = useState<number | null>(null);
  const [cost, setCost] = useState(5);
  const [best, setBest] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!minigameId) return;
    const j = await fetch(`/api/minigames/session?minigameId=${minigameId}`, {
      credentials: "include",
    }).then((r) => r.json());
    setMeUserId(j.meUserId ?? null);
    setTMoney(typeof j.tMoney === "number" ? j.tMoney : null);
    setUnlocked(!!j.unlocked);
    setCost(typeof j.cost === "number" ? j.cost : 5);
    setLoading(false);
  }, [minigameId]);

  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refresh]);

  async function purchase() {
    if (!minigameId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/minigames/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ minigameId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Purchase failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  if (!minigameId) {
    return (
      <main className="pageShell">
        <p>Unknown minigame.</p>
        <Link href="/minigames">← Arcade</Link>
      </main>
    );
  }

  const def = getMinigameDef(minigameId);

  return (
    <main className="pageShell" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/minigames" style={{ fontWeight: 800, textDecoration: "underline" }}>
          ← Minigames
        </Link>
      </div>

      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>{def.name}</h1>
      <p style={{ fontSize: 13, opacity: 0.8 }}>{def.blurb}</p>

      {loading && <p>Loading…</p>}

      {!loading && !meUserId && (
        <div className="theme-sidebar-panel" style={{ padding: 14, borderRadius: 12 }}>
          <Link href="/login" style={{ fontWeight: 1000 }}>
            Log in
          </Link>{" "}
          to play for {cost} R$.
        </div>
      )}

      {!loading && meUserId && !unlocked && (
        <div className="theme-sidebar-panel" style={{ padding: 14, borderRadius: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Balance: <b>{tMoney ?? "—"} R$</b> · Cost: <b>{cost} R$</b>
          </div>
          {error && <div style={{ color: "var(--text-error)", fontWeight: 800, marginBottom: 8 }}>{error}</div>}
          <button
            onClick={purchase}
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
            {busy ? "Paying…" : `Pay ${cost} R$ & play`}
          </button>
        </div>
      )}

      {!loading && unlocked && (
        <>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            Arcade session active — play as much as you want for the next couple hours. Scores here
            don&apos;t affect Castings/Frookies.
          </div>
          {renderGame(minigameId, {
            gameId: "arcade",
            meUserId,
            myScore: best,
            onSubmitScore: (score) => {
              if (typeof score === "number") setBest((b) => Math.max(b, score));
            },
          })}
        </>
      )}
    </main>
  );
}
