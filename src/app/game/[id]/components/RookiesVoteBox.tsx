"use client";

import { useMemo, useState } from "react";
import "@/styles/tengagedChat.css";

type Nominee = { userId: string; username: string };

/** Classic Rookies ranking vote: assign each point value once (0–3 or 1–3). */
export default function RookiesVoteBox(props: {
  gameId: string;
  nominees: Nominee[];
  locked?: boolean;
  onSaved: () => Promise<void>;
  tengaged?: boolean;
}) {
  const { gameId, nominees, tengaged } = props;
  const pointsOptions =
    nominees.length >= 4 ? [0, 1, 2, 3] : nominees.length === 3 ? [1, 2, 3] : [1, 2];

  const [pointsMap, setPointsMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    nominees.forEach((n) => (init[n.userId] = Number.NaN));
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const usedPoints = useMemo(() => {
    const s = new Set<number>();
    for (const n of nominees) {
      const v = pointsMap[n.userId];
      if (Number.isFinite(v)) s.add(v);
    }
    return s;
  }, [pointsMap, nominees]);

  const complete = useMemo(() => {
    const assigned = nominees.every((n) => Number.isFinite(pointsMap[n.userId]));
    if (!assigned) return false;
    const got = nominees.map((n) => pointsMap[n.userId]).sort((a, b) => a - b);
    const exp = [...pointsOptions].sort((a, b) => a - b);
    return got.join(",") === exp.join(",");
  }, [nominees, pointsMap, pointsOptions]);

  function setPoint(nomineeId: string, p: number) {
    setErr(null);
    setMsg(null);
    setPointsMap((prev) => {
      const next = { ...prev };
      if (next[nomineeId] === p) {
        next[nomineeId] = Number.NaN;
        return next;
      }
      for (const id of Object.keys(next)) {
        if (id !== nomineeId && next[id] === p) next[id] = Number.NaN;
      }
      next[nomineeId] = p;
      return next;
    });
  }

  async function save() {
    if (props.locked || !complete) return;
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/game/${gameId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rankings: pointsMap }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setErr(json?.error ?? "Vote failed");
    setMsg("Vote locked in.");
    await props.onSaved();
  }

  if (props.locked) {
    return <div className={tengaged ? "tgActionOk" : undefined} style={tengaged ? undefined : { fontWeight: 1000, color: "var(--success)" }}>Ranking vote locked in.</div>;
  }

  if (tengaged) {
    return (
      <div className="tgVoteList" style={{ marginTop: 4 }}>
        <div className="tgVoteHint">Assign each of {pointsOptions.join(", ")} once (higher = more want out).</div>
        {nominees.map((n) => {
          const myP = pointsMap[n.userId];
          return (
            <div key={n.userId} className="tgVoteRow">
              <div className="tgVoteName" title={n.username}>
                {n.username}
              </div>
              <div className="tgVotePts">
                {pointsOptions.map((p) => {
                  const selected = myP === p;
                  const disabled = !selected && usedPoints.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPoint(n.userId, p)}
                      disabled={saving || disabled}
                      className={selected ? "on" : undefined}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {err ? <div className="tgVoteErr">{err}</div> : null}
        {msg ? <div className="tgVoteOk">{msg}</div> : null}
        <button type="button" className="tgVoteSave" disabled={saving || !complete} onClick={save}>
          {saving ? "Saving…" : "Confirm ranking vote"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
        Assign each of <b>{pointsOptions.join(", ")}</b> once (higher = more want out).
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {nominees.map((n) => {
          const myP = pointsMap[n.userId];
          return (
            <div key={n.userId} style={{ display: "grid", gap: 6 }}>
              <div className="theme-username" style={{ fontSize: 12 }}>{n.username}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {pointsOptions.map((p) => {
                  const selected = myP === p;
                  const disabled = !selected && usedPoints.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPoint(n.userId, p)}
                      disabled={saving || disabled}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.18)",
                        background: selected ? "var(--bg-btn-send)" : "var(--bg-card)",
                        color: selected ? "var(--text-btn-send)" : "var(--text-primary)",
                        fontWeight: 1000,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.45 : 1,
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {err && <div style={{ marginTop: 10, color: "var(--text-error)", fontWeight: 1000 }}>{err}</div>}
      {msg && <div style={{ marginTop: 10, color: "var(--success)", fontWeight: 1000 }}>{msg}</div>}
      <button
        type="button"
        disabled={saving || !complete}
        onClick={save}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.12)",
          background: saving || !complete ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
          color: saving || !complete ? "var(--text-primary)" : "var(--text-btn-send)",
          fontWeight: 1000,
          cursor: saving || !complete ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Confirm ranking vote"}
      </button>
    </div>
  );
}
