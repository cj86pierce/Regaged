"use client";

import { useCallback, useEffect, useState } from "react";

type OwnerUser = {
  id: string;
  username: string;
  karma: number;
  tMoney: number;
  isOwner: boolean;
  isAdmin?: boolean;
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
  isOwner: boolean;
  warned: boolean;
  banned: boolean;
};

type SupportRow = {
  id: string;
  name: string;
  body: string;
  username: string | null;
  createdAt: string;
  readAt: string | null;
};

type NameAlertRow = {
  id: string;
  reason: string;
  createdAt: string;
  a: { id: string; username: string };
  b: { id: string; username: string };
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

  const [support, setSupport] = useState<SupportRow[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [supportErr, setSupportErr] = useState<string | null>(null);
  const [supportBusy, setSupportBusy] = useState(false);

  const [nameAlerts, setNameAlerts] = useState<NameAlertRow[]>([]);
  const [nameAlertErr, setNameAlertErr] = useState<string | null>(null);
  const [nameAlertBusy, setNameAlertBusy] = useState(false);

  const [giftUsername, setGiftUsername] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [giftDescription, setGiftDescription] = useState("");
  const [giftType, setGiftType] = useState("HAIR");
  const [giftFile, setGiftFile] = useState<File | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState<string | null>(null);

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

  const loadSupport = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setSupportBusy(true);
    try {
      const res = await fetch("/api/owner/support", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSupportErr(json?.error ?? "Failed to load support");
        setSupportBusy(false);
        return;
      }
      setSupportErr(null);
      setSupport(json.messages ?? []);
      setSupportUnread(typeof json.unread === "number" ? json.unread : 0);
    } catch {
      setSupportErr("Failed to load support");
    }
    setSupportBusy(false);
  }, []);

  const loadNameAlerts = useCallback(async () => {
    setNameAlertBusy(true);
    setNameAlertErr(null);
    try {
      const res = await fetch("/api/owner/name-alerts", { cache: "no-store", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNameAlertErr(json?.error ?? "Failed to load name alerts");
        setNameAlerts([]);
      } else {
        setNameAlerts(json.alerts ?? []);
      }
    } catch {
      setNameAlertErr("Failed to load name alerts");
      setNameAlerts([]);
    } finally {
      setNameAlertBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadOnline();
    void loadSupport();
    void loadNameAlerts();
  }, [loadOnline, loadSupport, loadNameAlerts]);

  useEffect(() => {
    void loadPlayers(page);
  }, [loadPlayers, page]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadOnline();
      void loadPlayers(page);
      void loadSupport();
      void loadNameAlerts();
    }, 15000);
    const onVis = () => {
      if (!document.hidden) {
        void loadOnline();
        void loadPlayers(page);
        void loadSupport();
        void loadNameAlerts();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadOnline, loadPlayers, loadSupport, loadNameAlerts, page]);

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
      setNewUsername(json.user.username);
      setUsername(json.user.username);
    }
    setMsg(action === "lookup" ? "Loaded." : "Done.");
    void loadOnline();
    void loadPlayers(page);
  }

  async function supportAction(id: string, action: "read" | "unread" | "delete") {
    const res = await fetch("/api/owner/support", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) void loadSupport();
  }

  async function dismissNameAlert(id: string) {
    const res = await fetch("/api/owner/name-alerts", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id }),
    });
    if (res.ok) void loadNameAlerts();
  }

  async function scanNameAlerts() {
    setNameAlertBusy(true);
    setNameAlertErr(null);
    try {
      const res = await fetch("/api/owner/name-alerts", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNameAlertErr(json?.error ?? "Scan failed");
      } else {
        setMsg(`Lookalike scan done — ${json.created ?? 0} new alert(s).`);
      }
      await loadNameAlerts();
    } catch {
      setNameAlertErr("Scan failed");
    } finally {
      setNameAlertBusy(false);
    }
  }

  async function grantDesign() {
    if (!giftFile || !giftUsername.trim() || !giftTitle.trim()) {
      setGiftMsg("Username, title, and PNG are required.");
      return;
    }
    setGiftBusy(true);
    setGiftMsg(null);
    try {
      const form = new FormData();
      form.set("username", giftUsername.trim());
      form.set("title", giftTitle.trim());
      form.set("description", giftDescription.trim() || giftTitle.trim());
      form.set("designType", giftType);
      form.set("file", giftFile);
      const res = await fetch("/api/owner/grant-design", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGiftMsg(json?.error ?? "Grant failed");
      } else {
        setGiftMsg(`Granted “${json.title}” (${json.designType}) to ${json.grantedTo}.`);
        setGiftTitle("");
        setGiftDescription("");
        setGiftFile(null);
      }
    } catch {
      setGiftMsg("Grant failed");
    } finally {
      setGiftBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 14,
          background: nameAlerts.length ? "rgba(201,162,39,0.10)" : "var(--bg-card)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Lookalike names{" "}
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>({nameAlerts.length})</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={nameAlertBusy} onClick={() => void loadNameAlerts()} style={{ fontSize: 12 }}>
              Refresh
            </button>
            <button type="button" disabled={nameAlertBusy} onClick={() => void scanNameAlerts()} style={{ fontSize: 12 }}>
              Scan recent
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Alert only — does not warn. Compare web tokens (user ids) side by side; click a name to look them up.
        </div>
        {nameAlertErr ? <div style={{ color: "var(--text-error)", fontSize: 13 }}>{nameAlertErr}</div> : null}
        {!nameAlertErr && !nameAlerts.length ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No lookalike alerts. Use “Scan recent” for existing accounts.</div>
        ) : null}
        <div style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {nameAlerts.map((a) => (
            <div
              key={a.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 10,
                background: "var(--bg-card)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                {a.reason} · {new Date(a.createdAt).toLocaleString()}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[a.a, a.b].map((side) => (
                  <button
                    key={side.id}
                    type="button"
                    onClick={() => void call("lookup", {}, side.username)}
                    style={{
                      textAlign: "left",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: 8,
                      background: "var(--bg-input)",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontFamily: "inherit", marginBottom: 4 }} className="theme-username">
                      {side.username}
                    </div>
                    <div style={{ wordBreak: "break-all", opacity: 0.85 }}>{side.id}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" style={{ fontSize: 12 }} onClick={() => void dismissNameAlert(a.id)}>
                  Dismiss
                </button>
              </div>
            </div>
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
            Support inbox{" "}
            <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>
              ({support.length}
              {supportUnread ? ` · ${supportUnread} unread` : ""})
            </span>
          </div>
          <button
            type="button"
            disabled={supportBusy}
            onClick={() => void loadSupport()}
            style={{ fontSize: 12 }}
          >
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          From /contact — name + message
        </div>
        {supportErr ? <div style={{ color: "var(--text-error)", fontSize: 13 }}>{supportErr}</div> : null}
        {!supportErr && !support.length ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No messages yet.</div>
        ) : null}
        <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {support.map((m) => (
            <div
              key={m.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 10,
                background: m.readAt ? "var(--bg-input)" : "rgba(102,187,106,0.12)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  {m.name}
                  {m.username ? (
                    <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>
                      {" "}
                      · @{m.username}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.4 }}>{m.body}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {!m.readAt ? (
                  <button type="button" style={{ fontSize: 12 }} onClick={() => void supportAction(m.id, "read")}>
                    Mark read
                  </button>
                ) : (
                  <button type="button" style={{ fontSize: 12 }} onClick={() => void supportAction(m.id, "unread")}>
                    Mark unread
                  </button>
                )}
                <button
                  type="button"
                  style={{ fontSize: 12, color: "#b91c1c" }}
                  onClick={() => {
                    if (confirm("Delete this message?")) void supportAction(m.id, "delete");
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
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
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Grant design to inventory</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Upload a PNG and put it straight into a player&apos;s avatar inventory (Customize Avatar). Not listed for community voting/auction.
        </div>
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Recipient username
            <input
              value={giftUsername}
              onChange={(e) => setGiftUsername(e.target.value)}
              placeholder="Username"
              style={{ padding: "8px 10px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Title
            <input
              value={giftTitle}
              onChange={(e) => setGiftTitle(e.target.value)}
              placeholder="Design title"
              style={{ padding: "8px 10px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Description (optional)
            <input
              value={giftDescription}
              onChange={(e) => setGiftDescription(e.target.value)}
              placeholder="Optional"
              style={{ padding: "8px 10px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Type
            <select
              value={giftType}
              onChange={(e) => setGiftType(e.target.value)}
              style={{ padding: "8px 10px" }}
            >
              {[
                "BODY",
                "HAIR",
                "EYES",
                "MOUTH",
                "SHIRT",
                "ACCESSORY",
                "BACKGROUND",
                "SCAR",
                "HAIR_ORNAMENT",
                "GLASSES",
              ].map((t) => (
                <option key={t} value={t}>
                  {t === "HAIR_ORNAMENT" ? "Hair ornament" : t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            PNG file (max 512KB)
            <input
              type="file"
              accept="image/png"
              onChange={(e) => setGiftFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={giftBusy || !giftFile || !giftUsername.trim() || !giftTitle.trim()}
            onClick={() => void grantDesign()}
            style={{ padding: "10px 12px", fontWeight: 900, width: "fit-content" }}
          >
            {giftBusy ? "Granting…" : "Grant to inventory"}
          </button>
          {giftMsg ? <div style={{ fontSize: 13, fontWeight: 700 }}>{giftMsg}</div> : null}
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
              {user.isOwner ? "Owner · " : user.isAdmin ? "Admin · " : ""}
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
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void call("set_currencies", {
                    karma: Number(karma),
                    tMoney: Number(tMoney),
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
                  disabled={busy || user.isOwner || !!user.isAdmin}
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
            {!user.isOwner && !user.isAdmin ? (
              <button type="button" disabled={busy} onClick={() => void call("grant_admin")}>
                Make Admin
              </button>
            ) : null}
            {!user.isOwner && user.isAdmin ? (
              <button type="button" disabled={busy} onClick={() => void call("revoke_admin")}>
                Remove Admin
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
