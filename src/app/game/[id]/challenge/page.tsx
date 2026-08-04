"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getMinigameDef, pickMinigameForDay } from "@/lib/minigamePicker";
import { renderMinigame } from "../components/minigames/renderMinigame";

export default function ChallengePage() {
  const params = useParams();
  const gameId = params.id as string;

  const [data, setData] = useState<{
    meUserId: string | null;
    myScore: number;
    gameType: string;
    state: string;
    roundNumber: number;
    survivorPhase: string | null;
    sittingOut: boolean;
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
    const gameType = json.game?.gameType ?? "";
    const isSurvivor = gameType === "SURVIVOR" || gameType === "SURVIVOR_BOT";
    setData({
      meUserId: json.meUserId ?? null,
      myScore: isSurvivor
        ? (me?.challengeScore ?? 0)
        : (me?.castingDayMiniGameScore ?? 0),
      gameType,
      state: json.game?.state ?? "",
      roundNumber: json.game?.roundNumber ?? 1,
      survivorPhase: json.game?.survivorPhase ?? null,
      sittingOut: !!me?.sittingOut,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [gameId]);

  const isCasting = data?.gameType === "CASTING" || data?.gameType === "CASTING_BOT";
  const isFrookies = data?.gameType === "FROOKIES" || data?.gameType === "FROOKIES_BOT";
  const isSurvivor = data?.gameType === "SURVIVOR" || data?.gameType === "SURVIVOR_BOT";
  const hasMinigame = isCasting || isFrookies || isSurvivor;
  const survivorChallenge =
    data?.survivorPhase === "TRIBE_CHALLENGE" || data?.survivorPhase === "INDIVIDUAL_CHALLENGE";
  const canPlay = isSurvivor
    ? data?.state === "ROUND_NOMINATE" && survivorChallenge && !data.sittingOut
    : data?.state === "ROUND_VOTE" || data?.state === "ROUND_NOMINATE";
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

      {hasMinigame && data?.sittingOut && isSurvivor && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>You are sitting out so both tribes send the same number of competitors.</p>
        </div>
      )}

      {hasMinigame && !canPlay && data && !data.sittingOut && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>
            {isSurvivor
              ? "Challenges are available during the tribe or individual challenge phase."
              : "Challenges are available during nomination or vote phases."}
          </p>
        </div>
      )}

      {hasMinigame && canPlay && data && minigame && def && (
        <>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>
              {isSurvivor || isFrookies ? "Round" : "Day"} {data.roundNumber}: {def.name}
            </div>
            {isSurvivor
              ? "Tribe totals win immunity; highest score on the losing tribe gets individual immunity. Best score counts if you retry."
              : isFrookies
                ? "Highest challenge score wins POV. You keep your best score if you retry."
                : "Low challenge score + low activity puts you at risk of nomination. Keys matter for final placements."}
          </div>
          {renderMinigame(minigame, {
            gameId,
            meUserId: data.meUserId,
            myScore: data.myScore,
            scoreMode: isSurvivor ? "survivor" : "casting",
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
