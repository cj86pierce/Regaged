"use client";

import { useEffect, useState } from "react";

type Status = {
  claimedToday: boolean;
  streak: number;
  longestStreak: number;
  nextReward: { tMoney: number; karma: number };
};

const ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DAILY_LOGIN === "1";

export default function DailyLoginCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/daily-login", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setStatus({
        claimedToday: !!json.claimedToday,
        streak: json.streak ?? 0,
        longestStreak: json.longestStreak ?? 0,
        nextReward: json.nextReward ?? { tMoney: 5, karma: 1 },
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ENABLED || !status) return null;

  async function claim() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/daily-login", { method: "POST", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json?.error ?? "Could not claim");
      return;
    }
    setStatus({
      claimedToday: true,
      streak: json.streak ?? 0,
      longestStreak: json.longestStreak ?? 0,
      nextReward: json.reward ?? json.nextReward ?? { tMoney: 0, karma: 0 },
    });
    setMsg(`+${json.reward?.tMoney ?? 0} R$ · +${json.reward?.karma ?? 0} karma`);
  }

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: "var(--bg-card)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 14 }}>Daily login</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Streak <b>{status.streak}</b>
            {status.longestStreak > 0 ? (
              <span style={{ opacity: 0.8 }}> · best {status.longestStreak}</span>
            ) : null}
            <span style={{ opacity: 0.65 }}> · local testing</span>
          </div>
        </div>
        {status.claimedToday ? (
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Claimed today</div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={claim}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.14)",
              background: "linear-gradient(#ffd85a, #ffb703)",
              fontWeight: 1000,
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            {busy
              ? "…"
              : `Claim ${status.nextReward.tMoney} R$ + ${status.nextReward.karma} karma`}
          </button>
        )}
      </div>
      {msg ? (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "var(--text-success, #2e7d32)" }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
