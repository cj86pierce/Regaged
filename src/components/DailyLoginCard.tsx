"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  claimedToday: boolean;
  streak: number;
  longestStreak: number;
  nextReward: { tMoney: number; karma: number };
};

const ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DAILY_LOGIN === "1";

export const DAILY_OPEN_EVENT = "regaged:daily-open";

function dismissKey() {
  const d = new Date();
  return `dailyLoginDismissed:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function DailyLoginCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/daily-login", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setStatus(null);
      setErr("Log in to claim your daily reward.");
      return null;
    }
    if (!res.ok) {
      setErr(json?.error ?? "Not available");
      return null;
    }
    const next: Status = {
      claimedToday: !!json.claimedToday,
      streak: json.streak ?? 0,
      longestStreak: json.longestStreak ?? 0,
      nextReward: json.nextReward ?? { tMoney: 5, karma: 1 },
    };
    setStatus(next);
    setErr(null);
    return next;
  }, []);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    (async () => {
      const next = await loadStatus();
      if (cancelled || !next || next.claimedToday) return;
      try {
        if (sessionStorage.getItem(dismissKey()) === "1") return;
      } catch {
        /* ignore */
      }
      setOpen(true);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!ENABLED) return;
    function onOpen() {
      setMsg(null);
      setOpen(true);
      loadStatus().catch(() => {});
    }
    window.addEventListener(DAILY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(DAILY_OPEN_EVENT, onOpen);
  }, [loadStatus]);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(dismissKey(), "1");
    } catch {
      /* ignore */
    }
  }

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
    window.setTimeout(() => close(), 900);
  }

  if (!ENABLED || !open) return null;

  return (
    <div className="tgDailyModal" role="dialog" aria-modal="true" aria-label="Daily">
      <button type="button" className="tgDailyModalBackdrop" aria-label="Close" onClick={close} />
      <div className="tgDailyPanel">
        <div className="tgDailyPanelHead">
          <h2>Daily</h2>
          <button type="button" className="tgDailyClose" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        {err ? (
          <p className="tgDailyMeta">{err}</p>
        ) : status ? (
          <>
            <p className="tgDailyMeta">
              Streak <b>{status.streak}</b>
              {status.longestStreak > 0 ? <span> · best {status.longestStreak}</span> : null}
            </p>
            {status.claimedToday ? (
              <p className="tgDailyClaimed">Claimed today</p>
            ) : (
              <button type="button" className="tgDailyClaim" disabled={busy} onClick={claim}>
                {busy
                  ? "…"
                  : `Claim ${status.nextReward.tMoney} R$ + ${status.nextReward.karma} karma`}
              </button>
            )}
            {msg ? <p className="tgDailyMsg">{msg}</p> : null}
          </>
        ) : (
          <p className="tgDailyMeta">Loading…</p>
        )}
      </div>
    </div>
  );
}

export function openDailyLogin() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DAILY_OPEN_EVENT));
  }
}
