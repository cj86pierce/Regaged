"use client";

import { useEffect, useState } from "react";
import "@/styles/tengagedChat.css";

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
  const [maxBet, setMaxBet] = useState(2);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game/${gameId}/rookies/bet`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOpen(!!d.bettingOpen || !!d.myBet);
        setContestants(d.contestants ?? []);
        setMyBet(d.myBet ?? null);
        if (typeof d.maxBet === "number" && d.maxBet > 0) {
          setMaxBet(d.maxBet);
          setAmount((a) => Math.min(a, d.maxBet));
        }
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
    <div className="tgAction">
      <div className="tgActionHead">Rookies betting</div>
      <div className="tgActionHint">
        Day 1 only · 1–{maxBet} T$ (your color power) · Non-players. 1st +100%, 2nd +30%, 3rd +20%, 4th +10%, 5th stake back.
      </div>
      {myBet ? (
        <div className="tgActionOk">
          Your bet: {myBet.amount} T$ on{" "}
          {contestants.find((c) => c.userId === myBet.targetUserId)?.username ?? "…"}
          {myBet.paidOutAt != null && <span> · paid {myBet.payoutAmount ?? 0} T$</span>}
        </div>
      ) : (
        <div className="tgActionStack">
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="tgActionInput"
          >
            <option value="">Pick contestant</option>
            {contestants.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.username}
              </option>
            ))}
          </select>
          <label className="tgActionHint">
            Stake{" "}
            <input
              type="number"
              min={1}
              max={maxBet}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="tgActionInput"
              style={{ width: 70, display: "inline-block", marginLeft: 6 }}
            />{" "}
            T$
          </label>
          <button
            type="button"
            className="tgActionBtn"
            disabled={busy || !targetUserId}
            onClick={() => void place()}
          >
            {busy ? "…" : "Place bet"}
          </button>
        </div>
      )}
      {msg && (
        <div className="tgActionOk" style={{ marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
