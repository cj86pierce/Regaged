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

  const [pointsMap, setPointsMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    nominees.forEach((n, i) => {
      init[n.userId] = pointsOptions[i] ?? pointsOptions[0];
    });
    return init;
  });

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = useMemo(() => {
    const vals = nominees.map((n) => pointsMap[n.userId]);
    const sorted = [...vals].sort((a, b) => a - b);
    return sorted.join(",") === [...pointsOptions].sort((a, b) => a - b).join(",");
  }, [nominees, pointsMap, pointsOptions]);

  function setPoints(userId: string, v: number) {
    setPointsMap((prev) => ({ ...prev, [userId]: v }));
  }

  async function submit() {
    setErr(null);
    if (!valid) return setErr(`Points must be ${pointsOptions.join(",")} (each used once).`);
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
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, background: "#fff", padding: 12 }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Vote</div>

      {myVoted ? (
        <div style={{ fontSize: 12, fontWeight: 1000, opacity: 0.8 }}>Vote locked in.</div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {nominees.map((n) => (
              <div key={n.userId} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.username}
                </div>

                <select
                  value={pointsMap[n.userId]}
                  onChange={(e) => setPoints(n.userId, Number(e.target.value))}
                  style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)" }}
                >
                  {pointsOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {err && <div style={{ marginTop: 10, color: "crimson", fontWeight: 1000 }}>{err}</div>}

          <button
            disabled={saving}
            onClick={submit}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: saving ? "#f3f6f9" : "#111",
              color: saving ? "#111" : "#fff",
              fontWeight: 1000,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Submitting..." : "Confirm vote"}
          </button>
        </>
      )}
    </div>
  );
}
