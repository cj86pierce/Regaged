"use client";

import { useState } from "react";

type OwnerUser = {
  id: string;
  username: string;
  karma: number;
  tMoney: number;
  pMoney: number;
  isOwner: boolean;
  banned: boolean;
  banReason: string | null;
  warned: boolean;
  warnedAt: string | null;
  lockedLoginIp: string | null;
};

export default function OwnerPanel() {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [karma, setKarma] = useState("");
  const [tMoney, setTMoney] = useState("");
  const [pMoney, setPMoney] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [banReason, setBanReason] = useState("");

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/owner/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: username.trim() || user?.username, action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json?.error ?? "Failed");
      return;
    }
    if (json.user) {
      setUser(json.user);
      setKarma(String(json.user.karma));
      setTMoney(String(json.user.tMoney));
      setPMoney(String(json.user.pMoney));
      setNewUsername(json.user.username);
      setUsername(json.user.username);
    }
    setMsg(action === "lookup" ? "Loaded." : "Done.");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={{ padding: "8px 10px", minWidth: 180 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void call("lookup");
          }}
        />
        <button type="button" disabled={busy || !username.trim()} onClick={() => void call("lookup")}>
          Lookup
        </button>
      </div>

      {msg ? <div style={{ color: "var(--text-muted)" }}>{msg}</div> : null}

      {user ? (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 14,
            background: "var(--bg-card)",
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{user.username}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {user.isOwner ? "Owner · " : ""}
              {user.warned ? "Warned · " : ""}
              {user.banned ? `Banned (${user.banReason ?? "—"})` : "Not banned"}
              {user.lockedLoginIp ? ` · IP lock: ${user.lockedLoginIp}` : ""}
            </div>
          </div>

          <section style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Currencies</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label>
                Karma{" "}
                <input value={karma} onChange={(e) => setKarma(e.target.value)} style={{ width: 90 }} />
              </label>
              <label>
                T${" "}
                <input value={tMoney} onChange={(e) => setTMoney(e.target.value)} style={{ width: 90 }} />
              </label>
              <label>
                P${" "}
                <input value={pMoney} onChange={(e) => setPMoney(e.target.value)} style={{ width: 90 }} />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void call("set_currencies", {
                    karma: Number(karma),
                    tMoney: Number(tMoney),
                    pMoney: Number(pMoney),
                  })
                }
              >
                Save currencies
              </button>
            </div>
          </section>

          <section style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Rename</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={{ minWidth: 160 }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void call("rename", { newUsername })}
              >
                Rename player
              </button>
            </div>
          </section>

          <section style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!user.warned ? (
              <button type="button" disabled={busy} onClick={() => void call("warn")}>
                Warn
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void call("clear_warn")}>
                Clear warn
              </button>
            )}
            {!user.banned ? (
              <>
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Ban reason"
                  style={{ minWidth: 160 }}
                />
                <button
                  type="button"
                  disabled={busy || user.isOwner}
                  onClick={() => void call("ban", { reason: banReason })}
                  style={{ color: "#b91c1c" }}
                >
                  Ban
                </button>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => void call("unban")}>
                Unban
              </button>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
