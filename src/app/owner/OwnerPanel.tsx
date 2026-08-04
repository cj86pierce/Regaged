"use client";

import { useCallback, useEffect, useState } from "react";

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

type OnlineRow = {
  id: string;
  username: string;
  lastSeenAt: string;
  karma: number;
  tMoney: number;
  pMoney: number;
  isOwner: boolean;
  warned: boolean;
  banned: boolean;
};

function secondsAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

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

  const [online, setOnline] = useState<OnlineRow[]>([]);
  const [onlineErr, setOnlineErr] = useState<string | null>(null);

  const loadOnline = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/owner/online", { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOnlineErr(json?.error ?? "Failed to load online");
        return;
      }
      setOnlineErr(null);
      setOnline(json.online ?? []);
    } catch {
      setOnlineErr("Failed to load online");
    }
  }, []);

  useEffect(() => {
    void loadOnline();
    const id = window.setInterval(() => void loadOnline(), 15000);
    const onVis = () => {
      if (!document.hidden) void loadOnline();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadOnline]);

  async function call(action: string, extra: Record<string, unknown> = {}, nameOverride?: string) {
    setBusy(true);
    setMsg(null);
    const name = (nameOverride ?? (username.trim() || user?.username || "")).trim();
    const res = await fetch("/api/owner/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name, action, ...extra }),
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
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 14,
          background: "var(--bg-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>
            Online now{" "}
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>({online.length})</span>
          </div>
          <button type="button" onClick={() => void loadOnline()} style={{ fontSize: 12 }}>
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Active in the last 5 minutes. Click a name to look them up.
        </div>
        {onlineErr ? <div style={{ color: "var(--text-error)", fontSize: 13 }}>{onlineErr}</div> : null}
        {!onlineErr && !online.length ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No one online right now.</div>
        ) : null}
        <div style={{ display: "grid", gap: 4, maxHeight: 280, overflow: "auto" }}>
          {online.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setUsername(o.username);
                void call("lookup", {}, o.username);
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span style={{ fontWeight: 800 }}>
                {o.username}
                {o.isOwner ? " · Owner" : ""}
                {o.warned ? " · Warned" : ""}
                {o.banned ? " · Banned" : ""}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                {secondsAgo(o.lastSeenAt)} · {o.karma}k · T${o.tMoney}
              </span>
            </button>
          ))}
        </div>
      </section>

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
