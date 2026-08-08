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

type PlayerRow = {
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

function recencyLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 5) return "online";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

  const [online, setOnline] = useState<PlayerRow[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineErr, setOnlineErr] = useState<string | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);

  const loadOnline = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setOnlineBusy(true);
    try {
      const res = await fetch("/api/owner/online", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOnlineErr(json?.error ?? "Failed to load online");
        setOnlineBusy(false);
        return;
      }
      setOnlineErr(null);
      setOnline(json.online ?? []);
      setOnlineCount(typeof json.count === "number" ? json.count : (json.online ?? []).length);
    } catch {
      setOnlineErr("Failed to load online");
    }
    setOnlineBusy(false);
  }, []);

  const loadPlayers = useCallback(async (p: number) => {
    if (typeof document !== "undefined" && document.hidden) return;
    setListBusy(true);
    try {
      const res = await fetch(`/api/owner/players?page=${p}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListErr(json?.error ?? "Failed to load players");
        setListBusy(false);
        return;
      }
      setListErr(null);
      setPlayers(json.players ?? []);
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    } catch {
      setListErr("Failed to load players");
    }
    setListBusy(false);
  }, []);

  useEffect(() => {
    void loadOnline();
  }, [loadOnline]);

  useEffect(() => {
    void loadPlayers(page);
  }, [loadPlayers, page]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadOnline();
      void loadPlayers(page);
    }, 15000);
    const onVis = () => {
      if (!document.hidden) {
        void loadOnline();
        void loadPlayers(page);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadOnline, loadPlayers, page]);

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
    void loadOnline();
    void loadPlayers(page);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Online now{" "}
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>({onlineCount})</span>
          </div>
          <button
            type="button"
            disabled={onlineBusy}
            onClick={() => void loadOnline()}
            style={{ fontSize: 12 }}
          >
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Same 5-minute window as the site “online” badge · click to look up
        </div>
        {onlineErr ? <div style={{ color: "var(--text-error)", fontSize: 13 }}>{onlineErr}</div> : null}
        {!onlineErr && !online.length ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>Nobody online right now.</div>
        ) : null}
        <div style={{ display: "grid", gap: 4 }}>
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
                {recencyLabel(o.lastSeenAt)} · {o.karma}k · T${o.tMoney}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 14,
          background: "var(--bg-card)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>
            All players by recency{" "}
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>({total})</span>
          </div>
          <button type="button" disabled={listBusy} onClick={() => void loadPlayers(page)} style={{ fontSize: 12 }}>
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          10 per page · most recently active first · click to look up
        </div>
        {listErr ? <div style={{ color: "var(--text-error)", fontSize: 13 }}>{listErr}</div> : null}
        {!listErr && !players.length ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No players found.</div>
        ) : null}
        <div style={{ display: "grid", gap: 4 }}>
          {players.map((o) => (
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
                {recencyLabel(o.lastSeenAt)} · {o.karma}k · T${o.tMoney}
              </span>
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={listBusy || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, fontWeight: 800 }}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={listBusy || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
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
