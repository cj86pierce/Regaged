"use client";

import { useEffect, useRef } from "react";

const TICK_INTERVAL_MS = 15_000;

/**
 * When a logged-in user has any page open, ping the tick so games advance
 * even without an external cron (e.g. on profile page, home, etc.).
 */
export default function CronPinger() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function ping() {
      try {
        const res = await fetch("/api/cron/tick", { method: "POST", credentials: "include" });
        return res.ok;
      } catch {
        return false;
      }
    }

    ping();
    intervalRef.current = setInterval(ping, TICK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
