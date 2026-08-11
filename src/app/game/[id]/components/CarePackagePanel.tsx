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
  tengaged?: boolean;
}) {
  const { gameId, carePackages, onClaimed, meUserId, tengaged } = props;
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
    <div className={tengaged ? "tgCare" : "theme-sidebar-panel"} style={tengaged ? undefined : { borderRadius: 12, padding: 12, flexShrink: 0 }}>
      <div className={tengaged ? "tgCareHead" : undefined} style={tengaged ? undefined : { fontWeight: 1000, marginBottom: 8 }}>
        Care packages
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--text-error)", marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: tengaged ? 8 : 12 }}>
        {unclaimed.map((cp) => {
          const busy = claiming[cp.eventId] === true;
          return (
            <div
              key={cp.eventId}
              className={tengaged ? "tgCareBox" : undefined}
              style={
                tengaged
                  ? undefined
                  : {
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 10,
                      background: "var(--bg-card)",
                    }
              }
            >
              <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 6 }}>Pick one</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                {(cp.options ?? [])
                  .sort((a, b) => a.slotIndex - b.slotIndex)
                  .map((o) => (
                    <button
                      key={o.slotIndex}
                      onClick={() => claim(cp.eventId, o.slotIndex)}
                      disabled={busy}
                      className={tengaged ? "tgCareSlot" : undefined}
                      style={
                        tengaged
                          ? undefined
                          : {
                              padding: "10px 0",
                              borderRadius: 10,
                              border: "1px solid var(--border)",
                              background: busy ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                              cursor: busy ? "not-allowed" : "pointer",
                              fontSize: 18,
                            }
                      }
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
