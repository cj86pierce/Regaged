"use client";

import { useState } from "react";

type CarePackage = {
  eventId: string;
  claimedAt: string | null;
  options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[];
};

function iconFor(kind: "APPLE" | "KEY" | "POISON") {
  if (kind === "APPLE") return "🍎";
  if (kind === "KEY") return "🔑";
  return "🧪";
}

export default function CarePackagePanel(props: {
  gameId: string;
  carePackages: CarePackage[];
  onClaimed: () => Promise<void>;
  meUserId: string | null;
}) {
  const { gameId, carePackages, onClaimed, meUserId } = props;
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const unclaimed = carePackages.filter((cp) => !cp.claimedAt);
  if (unclaimed.length === 0 || !meUserId) return null;

  async function claim(eventId: string, slotIndex: number) {
    if (claiming[eventId]) return;
    setErr(null);
    setClaiming((p) => ({ ...p, [eventId]: true }));

    try {
      const res = await fetch(`/api/game/${gameId}/casting/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, slotIndex }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error ?? "Claim failed");
        return;
      }
      await onClaimed();
    } finally {
      setClaiming((p) => ({ ...p, [eventId]: false }));
    }
  }

  return (
    <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12, flexShrink: 0 }}>
      <div style={{ fontWeight: 1000, marginBottom: 8 }}>Care Packages</div>
      {err && <div style={{ fontSize: 12, color: "crimson", marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {unclaimed.map((cp) => {
          const busy = claiming[cp.eventId] === true;
          return (
            <div
              key={cp.eventId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 10,
                background: "var(--bg-card)",
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 8 }}>Pick one slot</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {(cp.options ?? [])
                  .sort((a, b) => a.slotIndex - b.slotIndex)
                  .map((o) => (
                    <button
                      key={o.slotIndex}
                      onClick={() => claim(cp.eventId, o.slotIndex)}
                      disabled={busy}
                      style={{
                        padding: "10px 0",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: busy ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                        cursor: busy ? "not-allowed" : "pointer",
                        fontSize: 18,
                      }}
                      title={o.kind}
                    >
                      {iconFor(o.kind)}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
