"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MINIGAME_DEFS, MINIGAME_IDS, type MinigameId } from "@/lib/minigames/registry";

const COST = 5;

export default function MinigamesArcadePage() {
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [tMoney, setTMoney] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<MinigameId | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/minigames/session?minigameId=matching", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setMeUserId(j.meUserId ?? null);
        setTMoney(typeof j.tMoney === "number" ? j.tMoney : null);
      })
      .catch(() => {});
  }, []);

  async function play(id: MinigameId) {
    setMsg(null);
    if (!meUserId) {
      setMsg("Log in to play arcade minigames.");
      return;
    }
    setBusyId(id);
    try {
      // Reuse existing session if still unlocked
      const check = await fetch(`/api/minigames/session?minigameId=${id}`, {
        credentials: "include",
      }).then((r) => r.json());
      if (check.unlocked) {
        window.location.href = `/minigames/${id}`;
        return;
      }

      const res = await fetch("/api/minigames/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ minigameId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not start");
      if (typeof json.cost === "number" && tMoney != null) setTMoney(tMoney - json.cost);
      window.location.href = json.playUrl ?? `/minigames/${id}`;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to start");
      setBusyId(null);
    }
  }

  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Minigames</h1>
      <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.45 }}>
        Practice any challenge for <b>{COST} R$</b> each. Same games used in Castings &amp; Frookies
        competitions — arcade scores are for fun and don&apos;t affect live games.
      </p>

      <div style={{ fontSize: 13, marginBottom: 14 }}>
        {meUserId ? (
          <>
            Balance: <b>{tMoney ?? "—"} R$</b>
          </>
        ) : (
          <>
            <Link href="/login" style={{ fontWeight: 800 }}>
              Log in
            </Link>{" "}
            to play.
          </>
        )}
      </div>

      {msg && (
        <div style={{ color: "var(--text-error)", fontWeight: 800, marginBottom: 12, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {MINIGAME_IDS.map((id) => {
          const def = MINIGAME_DEFS[id];
          return (
            <div
              key={id}
              className="theme-sidebar-panel"
              style={{
                padding: 14,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 1000 }}>{def.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{def.blurb}</div>
              </div>
              <button
                onClick={() => play(id)}
                disabled={busyId === id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--accent-bg)",
                  fontWeight: 1000,
                  cursor: busyId === id ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {busyId === id ? "Starting…" : `Play · ${COST} R$`}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
