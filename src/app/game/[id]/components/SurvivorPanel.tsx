"use client";

import { useState } from "react";

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
};

export default function SurvivorPanel(props: {
  gameId: string;
  phase: string | null | undefined;
  losingTribe?: string | null;
  merged?: boolean;
  meUserId: string | null;
  players: Player[];
  supplies?: {
    tribeAFood: number;
    tribeAWater: number;
    tribeAFire: boolean;
    tribeBFood: number;
    tribeBWater: number;
    tribeBFire: boolean;
  } | null;
  onRefresh: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = props.players.find((p) => p.userId === props.meUserId);
  const phase = props.phase ?? "";
  const isChallenge = ["TRIBE_CHALLENGE", "IMMUNITY", "INDIVIDUAL_CHALLENGE", "INDIVIDUAL_IMMUNITY"].includes(
    phase
  );
  const isVote = phase === "TRIBAL_COUNCIL" || phase === "VOTE";

  const voteTargets = props.players.filter((p) => {
    if (p.status !== "ACTIVE" || p.hasImmunity || p.userId === props.meUserId) return false;
    if (!props.merged && phase === "TRIBAL_COUNCIL") {
      return p.tribe === props.losingTribe;
    }
    return true;
  });

  async function compete() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/game/${props.gameId}/survivor/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: 10 + Math.floor(Math.random() * 15) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error ?? "Failed");
    setMsg(`Score: ${json.challengeScore}`);
    props.onRefresh();
  }

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
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: "var(--bg-card)",
        marginBottom: 10,
      }}
    >
      <div style={{ fontWeight: 1000, color: "#2e7d32", marginBottom: 6 }}>Survivor</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        Phase: <strong>{phase.replace(/_/g, " ") || "—"}</strong>
        {props.losingTribe ? ` · Losing tribe ${props.losingTribe}` : ""}
        {props.merged ? " · Merged" : ""}
      </div>

      {props.supplies && !props.merged && (
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 8, display: "grid", gap: 2 }}>
          <div>
            Tribe A — food {props.supplies.tribeAFood} · water {props.supplies.tribeAWater} · fire{" "}
            {props.supplies.tribeAFire ? "on" : "off"}
          </div>
          <div>
            Tribe B — food {props.supplies.tribeBFood} · water {props.supplies.tribeBWater} · fire{" "}
            {props.supplies.tribeBFire ? "on" : "off"}
          </div>
        </div>
      )}

      {me && me.status === "ACTIVE" && (
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          You: tribe {me.tribe ?? "?"} · food {me.food ?? 0} · water {me.water ?? 0} · HP{" "}
          {me.health ?? 0}
          {me.hasImmunity ? " · IMMUNE" : ""} · score {me.challengeScore ?? 0}
        </div>
      )}

      {isChallenge && me?.status === "ACTIVE" && (
        <button type="button" disabled={busy} onClick={() => void compete()} style={{ marginBottom: 8 }}>
          {busy ? "…" : "Compete (+score)"}
        </button>
      )}

      {isVote && me?.status === "ACTIVE" && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Vote someone out</div>
          {voteTargets.map((t) => (
            <button
              key={t.userId}
              type="button"
              disabled={busy}
              onClick={() => void vote(t.userId)}
              style={{ textAlign: "left" }}
            >
              {t.username}
              {t.tribe ? ` (tribe ${t.tribe})` : ""}
            </button>
          ))}
          {!voteTargets.length && <div style={{ fontSize: 12, opacity: 0.7 }}>No valid targets.</div>}
        </div>
      )}

      {msg && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800 }}>{msg}</div>}
    </div>
  );
}
