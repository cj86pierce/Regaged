"use client";

import { useMemo, useState } from "react";

type Nominee = { userId: string; username: string };

export default function CastingVoteBox(props: {
  gameId: string;
  dayNumber: number;
  nominees: Nominee[];
  myVoted: boolean;
  onVoted: () => Promise<void>;
}) {
  const { gameId, nominees, myVoted } = props;

  const pointsOptions = nominees.length === 4 ? [0, 1, 2, 3] : [1, 2, 3];

  // pointsMap: nomineeUserId -> points
  const [pointsMap, setPointsMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    // start unassigned
    nominees.forEach((n) => (init[n.userId] = Number.NaN));
    return init;
  });

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usedPoints = useMemo(() => {
    const s = new Set<number>();
    for (const n of nominees) {
      const v = pointsMap[n.userId];
      if (Number.isFinite(v)) s.add(v);
    }
    return s;
  }, [pointsMap, nominees]);

  const complete = useMemo(() => {
    // all nominees assigned a number AND the used set equals allowed set
    const assigned = nominees.every((n) => Number.isFinite(pointsMap[n.userId]));
    if (!assigned) return false;

    const got = nominees.map((n) => pointsMap[n.userId]).sort((a, b) => a - b);
    const exp = [...pointsOptions].sort((a, b) => a - b);
    return got.join(",") === exp.join(",");
  }, [nominees, pointsMap, pointsOptions]);

  function setPoint(nomineeId: string, p: number) {
    setErr(null);

    setPointsMap((prev) => {
      const next = { ...prev };

      // If this nominee already has this point, toggle off (unassign)
      if (next[nomineeId] === p) {
        next[nomineeId] = Number.NaN;
        return next;
      }

      // If some other nominee already uses this point, remove it there first
      for (const id of Object.keys(next)) {
        if (id !== nomineeId && next[id] === p) {
          next[id] = Number.NaN;
        }
      }

      next[nomineeId] = p;
      return next;
    });
  }

  async function submit() {
    setErr(null);
    if (!complete) {
      return setErr(`Assign ${pointsOptions.join(",")} once each.`);
    }

    setSaving(true);

    const res = await fetch(`/api/game/${gameId}/casting/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pointsMap }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) return setErr(json?.error ?? "Vote failed");

    await props.onVoted();
  }

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        padding: 12,

        // ✅ prevents “infinite stretching”
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Vote</div>

      {myVoted ? (
        <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.8 }}>Vote locked in.</div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {nominees.map((n) => {
              const myP = pointsMap[n.userId];
              return (
                <div key={n.userId} style={{ display: "grid", gap: 6 }}>
                  <div
                    title={n.username}
                    style={{
                      fontWeight: 900,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {n.username}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pointsOptions.map((p) => {
                      const selected = myP === p;
                      const disabled = !selected && usedPoints.has(p); // used by someone else
                      return (
                        <button
                          key={p}
                          onClick={() => setPoint(n.userId, p)}
                          disabled={disabled || saving}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.18)",
                            background: selected ? "#111" : "#fff",
                            color: selected ? "#fff" : "#111",
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

          {err && <div style={{ marginTop: 10, color: "crimson", fontWeight: 1000 }}>{err}</div>}

          <button
            disabled={saving || !complete}
            onClick={submit}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: saving || !complete ? "#f3f6f9" : "#111",
              color: saving || !complete ? "#111" : "#fff",
              fontWeight: 1000,
              cursor: saving || !complete ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Submitting..." : complete ? "Confirm vote" : "Assign all points"}
          </button>
        </>
      )}
    </div>
  );
}
