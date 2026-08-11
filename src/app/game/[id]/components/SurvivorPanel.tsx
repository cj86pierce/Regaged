"use client";

import Link from "next/link";
import { useState } from "react";
import { getMinigameDef, pickMinigameForDay } from "@/lib/minigamePicker";
import SurvivorCamp, { type CampSupplies } from "./SurvivorCamp";
import "@/styles/tengagedChat.css";

type Player = {
  userId: string;
  username: string;
  status: string;
  tribe?: string | null;
  food?: number;
  water?: number;
  health?: number;
  hasImmunity?: boolean;
  challengeScore?: number;
  sittingOut?: boolean;
};

export default function SurvivorPanel(props: {
  gameId: string;
  phase: string | null | undefined;
  roundNumber: number;
  losingTribe?: string | null;
  merged?: boolean;
  meUserId: string | null;
  players: Player[];
  supplies?: CampSupplies | null;
  onRefresh: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = props.players.find((p) => p.userId === props.meUserId);
  const phase = props.phase ?? "";
  const isChallenge = phase === "TRIBE_CHALLENGE" || phase === "INDIVIDUAL_CHALLENGE";
  const atTribalCouncil = phase === "TRIBAL_COUNCIL";
  const atMergeVote = phase === "VOTE";
  const onLosingTribe =
    !!me &&
    me.status === "ACTIVE" &&
    (me.tribe === "A" || me.tribe === "B") &&
    me.tribe === props.losingTribe;
  // Only the losing tribe sees Tribal Council vote UI; merge votes are for everyone.
  const showVoteUi =
    me?.status === "ACTIVE" &&
    ((atTribalCouncil && onLosingTribe) || (atMergeVote && !!props.merged));
  const safeDuringTribal =
    atTribalCouncil &&
    me?.status === "ACTIVE" &&
    (me.tribe === "A" || me.tribe === "B") &&
    me.tribe !== props.losingTribe;
  const minigameId = pickMinigameForDay(props.gameId, props.roundNumber || 1);
  const minigameDef = getMinigameDef(minigameId);

  const competeCountA = props.players.filter(
    (p) => p.status === "ACTIVE" && p.tribe === "A" && !p.sittingOut
  ).length;
  const competeCountB = props.players.filter(
    (p) => p.status === "ACTIVE" && p.tribe === "B" && !p.sittingOut
  ).length;

  const voteTargets = props.players.filter((p) => {
    if (p.status !== "ACTIVE" || p.hasImmunity || p.userId === props.meUserId) return false;
    if (!props.merged && phase === "TRIBAL_COUNCIL") {
      return p.tribe === props.losingTribe;
    }
    return true;
  });

  async function vote(targetUserId: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/game/${props.gameId}/survivor/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error ?? "Vote failed");
    setMsg("Vote locked in.");
    props.onRefresh();
  }

  return (
    <div className="tgAction">
      <div className="tgActionHead">Survivor</div>
      <div className="tgActionHint">
        Phase: <strong>{phase.replace(/_/g, " ") || "—"}</strong>
        {showVoteUi && props.losingTribe ? " · Your tribe is at Tribal Council" : ""}
        {props.merged ? " · Merged" : ""}
      </div>

      {me && me.status === "ACTIVE" && props.supplies && (
        <SurvivorCamp
          gameId={props.gameId}
          merged={!!props.merged}
          myTribe={me.tribe}
          personalFood={me.food ?? 0}
          personalWater={me.water ?? 0}
          health={me.health ?? 0}
          supplies={props.supplies}
          onRefresh={props.onRefresh}
        />
      )}

      {me && me.status === "ACTIVE" && (
        <div className="tgActionHint">
          You: tribe {me.tribe ?? "?"}
          {me.hasImmunity ? " · IMMUNE" : ""}
          {me.sittingOut ? " · SITTING OUT" : ""}
          {isChallenge ? ` · score ${me.challengeScore ?? 0}` : ""}
          {!props.merged && isChallenge ? ` · A competing ${competeCountA} / B ${competeCountB}` : ""}
        </div>
      )}

      {isChallenge && me?.status === "ACTIVE" && me.sittingOut && (
        <div className="tgActionHint">Sitting out so both tribes send the same number of competitors.</div>
      )}

      {isChallenge && me?.status === "ACTIVE" && !me.sittingOut && (
        <div style={{ marginTop: 6 }}>
          <div className="tgActionHint">
            Competition: <b>{minigameDef.name}</b>
          </div>
          <Link href={`/game/${props.gameId}/challenge`} className="tgActionBtn link">
            Play competition →
          </Link>
        </div>
      )}

      {safeDuringTribal && (
        <div className="tgActionHint">Your tribe won immunity. Sit tight while the other tribe goes to Tribal Council.</div>
      )}

      {showVoteUi && (
        <div className="tgActionStack" style={{ marginTop: 6 }}>
          <div className="tgActionHead" style={{ fontSize: 11 }}>
            Vote someone out
          </div>
          {voteTargets.map((t) => (
            <button
              key={t.userId}
              type="button"
              className="tgActionBtn secondary"
              disabled={busy}
              onClick={() => void vote(t.userId)}
            >
              {t.username}
              {t.tribe ? ` (tribe ${t.tribe})` : ""}
            </button>
          ))}
          {!voteTargets.length && <div className="tgActionHint">No valid targets.</div>}
        </div>
      )}

      {msg && <div className="tgActionOk" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
