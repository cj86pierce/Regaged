"use client";

import { useEffect, useState } from "react";

const POLL_MS = 30 * 1000;

export default function OnlineCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function touchAndFetchCount() {
      await fetch("/api/me/heartbeat", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);

      fetch("/api/online-count", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setCount(typeof d.count === "number" ? d.count : 0))
        .catch(() => setCount(null));
    }

    function onVisibilityChange() {
      if (!document.hidden) touchAndFetchCount();
    }

    touchAndFetchCount();
    const t = setInterval(touchAndFetchCount, POLL_MS);
    window.addEventListener("focus", touchAndFetchCount);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", touchAndFetchCount);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (count === null) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: 10,
        zIndex: 1000,
        fontSize: 12,
        color: "var(--text-muted)",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "4px 8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
      title="Users active in the last 5 minutes (excluding bots)"
    >
      {count} online
    </div>
  );
}
