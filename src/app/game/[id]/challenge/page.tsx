"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getMinigameDef, pickMinigameForDay, type MinigameId } from "@/lib/minigamePicker";
import EmojiMatchingGame from "../components/minigames/EmojiMatchingGame";
import EmojiMatch3Game from "../components/minigames/EmojiMatch3Game";
import RhythmGame from "../components/minigames/RhythmGame";
import DealOrNoDealGame from "../components/minigames/DealOrNoDealGame";
import SimonGame from "../components/minigames/SimonGame";
import ReactionGame from "../components/minigames/ReactionGame";
import MathRushGame from "../components/minigames/MathRushGame";
import DodgeGame from "../components/minigames/DodgeGame";
import type { MinigameProps } from "../components/minigames/types";

function renderMinigame(id: MinigameId, props: MinigameProps) {
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

export default function ChallengePage() {
  const params = useParams();
  const gameId = params.id as string;

  const [data, setData] = useState<{
    meUserId: string | null;
    myScore: number;
    gameType: string;
    state: string;
    roundNumber: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=1&pageSize=1`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load");
    const me = json.meUserId
      ? json.players?.find((p: { userId: string }) => p.userId === json.meUserId)
      : null;
    setData({
      meUserId: json.meUserId ?? null,
      myScore: me?.castingDayMiniGameScore ?? 0,
      gameType: json.game?.gameType ?? "",
      state: json.game?.state ?? "",
      roundNumber: json.game?.roundNumber ?? 1,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [gameId]);

  const isCasting = data?.gameType === "CASTING" || data?.gameType === "CASTING_BOT";
  const isFrookies = data?.gameType === "FROOKIES" || data?.gameType === "FROOKIES_BOT";
  const hasMinigame = isCasting || isFrookies;
  const canPlay = data?.state === "ROUND_VOTE" || data?.state === "ROUND_NOMINATE";
  const minigame = data ? pickMinigameForDay(gameId, data.roundNumber) : null;
  const def = minigame ? getMinigameDef(minigame) : null;

  if (error)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "var(--text-error)" }}>{error}</p>
        <Link href={`/game/${gameId}`}>← Back to game</Link>
      </main>
    );

  return (
    <main style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/game/${gameId}`} style={{ fontWeight: 800, textDecoration: "underline" }}>
          ← Back to game
        </Link>
      </div>

      {!hasMinigame && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>This game type does not have daily challenges.</p>
        </div>
      )}

      {hasMinigame && !canPlay && data && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>Challenges are available during nomination or vote phases.</p>
        </div>
      )}

      {hasMinigame && canPlay && data && minigame && def && (
        <>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>
              {isFrookies ? "Round" : "Day"} {data.roundNumber}: {def.name}
            </div>
            {isFrookies
              ? "Highest challenge score wins POV. You keep your best score if you retry."
              : "Low challenge score + low activity puts you at risk of nomination. Keys matter for final placements."}
          </div>
          {renderMinigame(minigame, {
            gameId,
            meUserId: data.meUserId,
            myScore: data.myScore,
            onSubmitScore: () => {
              void load();
            },
          })}
        </>
      )}

      {!data && <p>Loading…</p>}
    </main>
  );
}
