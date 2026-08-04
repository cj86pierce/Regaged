"use client";

import { useEffect, useState } from "react";

type Contestant = { userId: string; username: string };

export default function RookiesBetPanel({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [amount, setAmount] = useState(10);
  const [myBet, setMyBet] = useState<{
    amount: number;
    targetUserId: string;
    paidOutAt: string | null;
    payoutAmount: number | null;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game/${gameId}/rookies/bet`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOpen(!!d.bettingOpen || !!d.myBet);
        setContestants(d.contestants ?? []);
        setMyBet(d.myBet ?? null);
        if (d.myBet?.targetUserId) setTargetUserId(d.myBet.targetUserId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!open && !myBet) return null;

  async function place() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/game/${gameId}/rookies/bet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId, amount }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error ?? "Bet failed");
    setMsg("Bet placed!");
    setMyBet({ amount, targetUserId, paidOutAt: null, payoutAmount: null });
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
      <div style={{ fontWeight: 1000, marginBottom: 6, color: "#2e7d32" }}>Rookies betting</div>
      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 8 }}>
        Day 1 only · 1–30 T$ · Non-players. 1st +100%, 2nd +30%, 3rd +20%, 4th +10%, 5th stake back.
      </div>
      {myBet ? (
        <div style={{ fontSize: 13, fontWeight: 800 }}>
          Your bet: {myBet.amount} T$ on{" "}
          {contestants.find((c) => c.userId === myBet.targetUserId)?.username ?? "…"}
          {myBet.paidOutAt != null && (
            <span> · paid {myBet.payoutAmount ?? 0} T$</span>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            style={{ padding: 8 }}
          >
            <option value="">Pick contestant</option>
            {contestants.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.username}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 13 }}>
            Stake{" "}
            <input
              type="number"
              min={1}
              max={30}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ width: 70, marginLeft: 6 }}
            />{" "}
            T$
          </label>
          <button type="button" disabled={busy || !targetUserId} onClick={() => void place()}>
            {busy ? "…" : "Place bet"}
          </button>
        </div>
      )}
      {msg && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800 }}>{msg}</div>}
    </div>
  );
}
