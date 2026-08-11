"use client";

import { useEffect, useMemo, useState } from "react";

type Nominee = { userId: string; username: string };

function hasSavedVotes(
  nominees: Nominee[],
  map: Record<string, number> | null | undefined
): boolean {
  if (!map) return false;
  return nominees.every((n) => typeof map[n.userId] === "number" && Number.isFinite(map[n.userId]));
}

export default function CastingVoteBox(props: {
  gameId: string;
  nominees: Nominee[];
  initialPointsMap?: Record<string, number> | null;
  onSaved: () => Promise<void>;
  tengaged?: boolean;
}) {
  const { gameId, nominees, initialPointsMap, tengaged } = props;

  // Must match nominee count so every point value is assigned exactly once
  const pointsOptions =
    nominees.length === 4
      ? [0, 1, 2, 3]
      : nominees.length === 2
        ? [1, 2]
        : [1, 2, 3];

  function buildMap(from: Record<string, number> | null | undefined): Record<string, number> {
    const init: Record<string, number> = {};
    for (const n of nominees) {
      const v = from?.[n.userId];
      init[n.userId] = typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
    }
    return init;
  }

  const alreadySaved = hasSavedVotes(nominees, initialPointsMap);

  const [pointsMap, setPointsMap] = useState<Record<string, number>>(() => buildMap(initialPointsMap));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(() => (alreadySaved ? "Saved!" : null));
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(() => !alreadySaved);

  // Rehydrate when leaving/returning or after a poll — votes live in DB, not only local state.
  const savedKey = JSON.stringify(
    nominees.map((n) => [n.userId, initialPointsMap?.[n.userId] ?? null])
  );
  useEffect(() => {
    const saved = hasSavedVotes(nominees, initialPointsMap);
    setPointsMap(buildMap(initialPointsMap));
    setMsg(saved ? "Saved!" : null);
    setErr(null);
    // Stay collapsed if already saved; only force-open when there is nothing saved yet.
    if (!saved) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedKey captures nominees + initialPointsMap
  }, [savedKey]);

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

  const summary = useMemo(() => {
    return nominees
      .map((n) => {
        const p = pointsMap[n.userId];
        if (!Number.isFinite(p)) return null;
        return { id: n.userId, name: n.username, points: p as number };
      })
      .filter(Boolean) as { id: string; name: string; points: number }[];
  }, [nominees, pointsMap]);

  function setPoint(nomineeId: string, p: number) {
    setErr(null);
    setMsg(null);

    setPointsMap((prev) => {
      const next = { ...prev };

      // toggle off if clicked again
      if (next[nomineeId] === p) {
        next[nomineeId] = Number.NaN;
        return next;
      }

      // remove this point from anyone else
      for (const id of Object.keys(next)) {
        if (id !== nomineeId && next[id] === p) next[id] = Number.NaN;
      }

      next[nomineeId] = p;
      return next;
    });
  }

  async function save() {
    setErr(null);
    setMsg(null);

    if (!complete) return setErr(`Assign ${pointsOptions.join(",")} once each.`);

    setSaving(true);
    const res = await fetch(`/api/game/${gameId}/casting/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pointsMap }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setErr(json?.error ?? "Save failed");

    setMsg("Saved!");
    setOpen(false);
    await props.onSaved();
  }

  if (tengaged) {
    if (!open) {
      return (
        <div className="tgVote tgVoteCollapsed">
          <button type="button" className="tgVoteToggle" onClick={() => setOpen(true)}>
            <span className="tgVoteToggleLabel">
              <span className="tgVoteHead">Vote</span>
              <span className="tgVoteOkInline">Saved</span>
            </span>
            <span className="tgVoteEdit">Edit votes ▾</span>
          </button>
          {summary.length > 0 ? (
            <ul className="tgVoteSummary">
              {[...summary]
                .sort((a, b) => b.points - a.points)
                .map((s) => (
                  <li key={s.id}>
                    <span className="name">{s.name}</span>
                    <span className="pts">{s.points}</span>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      );
    }

    return (
      <div className="tgVote">
        <div className="tgVoteHeadRow">
          <div className="tgVoteHead">Vote</div>
          {msg === "Saved!" || alreadySaved ? (
            <button type="button" className="tgVoteCollapseBtn" onClick={() => setOpen(false)}>
              Collapse ▴
            </button>
          ) : null}
        </div>
        <div className="tgVoteHint">Give each nominee a different score</div>
        <div className="tgVoteList">
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
        </div>
        {err ? <div className="tgVoteErr">{err}</div> : null}
        {msg ? <div className="tgVoteOk">{msg}</div> : null}
        <button type="button" className="tgVoteSave" disabled={saving || !complete} onClick={save}>
          {saving ? "Saving…" : msg === "Saved!" || alreadySaved ? "Update votes" : "Save votes"}
        </button>
      </div>
    );
  }

  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12, maxHeight: 340, overflowY: "auto" }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Vote</div>

      <div style={{ display: "grid", gap: 10 }}>
        {nominees.map((n) => {
          const myP = pointsMap[n.userId];
          return (
            <div key={n.userId} style={{ display: "grid", gap: 6 }}>
              <div title={n.username} className="theme-username" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.username}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {pointsOptions.map((p) => {
                  const selected = myP === p;
                  const disabled = !selected && usedPoints.has(p);
                  return (
                    <button
                      key={p}
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
        disabled={saving || !complete}
        onClick={save}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.12)",
          background: saving || !complete ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
          color: saving || !complete ? "var(--text-primary)" : "var(--text-btn-send)",
          fontWeight: 1000,
          cursor: saving || !complete ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : msg === "Saved!" ? "Update votes" : "Save votes"}
      </button>
    </div>
  );
}
