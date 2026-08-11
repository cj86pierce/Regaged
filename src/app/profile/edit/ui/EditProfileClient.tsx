"use client";

import Link from "next/link";
import { useState } from "react";
import Avatar, { type AvatarConfig, type SlotDesignType } from "@/components/Avatar";

export default function EditProfileClient(props: {
  initialBio: string;
  email: string;
  emailVerifiedAt: string | null;
  username: string;
  usernameChangedAt: string | null;
  avatar: AvatarConfig;
  slotDesigns?: Partial<Record<SlotDesignType, string>>;
  colorHistory?: { name: string; purchasedAt: string }[];
}) {
  const [bio, setBio] = useState(props.initialBio);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [username, setUsername] = useState(props.username);
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState<string | null>(null);

  const [email, setEmail] = useState(props.email ?? "");
  const [code, setCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const verified = !!props.emailVerifiedAt;

  const yearMs = 365 * 24 * 60 * 60 * 1000;
  const nextChangeAt = props.usernameChangedAt
    ? new Date(props.usernameChangedAt).getTime() + yearMs
    : 0;
  const canChangeUsername = !props.usernameChangedAt || Date.now() >= nextChangeAt;

  async function saveBio() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/profile/bio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg(json?.error ?? "Save failed");
    setMsg("Saved!");
  }

  async function saveUsername() {
    setUserBusy(true);
    setUserMsg(null);
    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const json = await res.json().catch(() => ({}));
    setUserBusy(false);
    if (!res.ok) return setUserMsg(json?.error ?? "Failed");
    setUserMsg("Username updated!");
    setTimeout(() => window.location.reload(), 800);
  }

  async function sendCode() {
    setEmailBusy(true);
    setEmailMsg(null);
    const res = await fetch("/api/verify-email/send-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (!res.ok) return setEmailMsg(json?.error ?? "Failed to send code");
    setEmailMsg("Code sent. Check your email (spam/promotions too).");
  }

  async function confirmCode() {
    setEmailBusy(true);
    setEmailMsg(null);
    const res = await fetch("/api/verify-email/confirm-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (!res.ok) return setEmailMsg(json?.error ?? "Verification failed");
    setEmailMsg("✅ Verified! Refreshing…");
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <main style={{ padding: 12, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Edit Profile</h1>

      {/* Avatar — click to editor */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--edit-panel-bg)", padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Avatar</div>
        <Link href="/profile/avatar" title="Edit avatar" style={{ display: "inline-block" }}>
          <Avatar config={props.avatar} width={120} slotDesigns={props.slotDesigns} />
        </Link>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>Click avatar to customize</div>
      </div>

      {/* Username */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--edit-panel-bg)", padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Username</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          1 change per year{!canChangeUsername && nextChangeAt ? ` · next change ${new Date(nextChangeAt).toLocaleDateString()}` : ""}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!canChangeUsername}
            style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={saveUsername}
            disabled={userBusy || !canChangeUsername || username.trim() === props.username}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-btn-send)",
              color: "var(--text-btn-send)",
              fontWeight: 1000,
              cursor: userBusy || !canChangeUsername ? "not-allowed" : "pointer",
            }}
          >
            {userBusy ? "…" : "Change username"}
          </button>
        </div>
        {userMsg && <div style={{ marginTop: 8, fontWeight: 1000 }}>{userMsg}</div>}
      </div>

      {/* BIO */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--edit-panel-bg)", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Bio</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Paste a GIF/image URL (https … .gif) and it will show on your profile.
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={8}
          maxLength={1000}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
          placeholder="Write your bio…"
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={saveBio}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: saving ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
              color: saving ? "var(--text-muted)" : "var(--text-btn-send)",
              fontWeight: 1000,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Bio"}
          </button>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{bio.length}/1000</div>
          {msg && <div style={{ fontWeight: 1000, color: "var(--text-primary)" }}>{msg}</div>}
        </div>
      </div>

      {/* Color unlock history (kept off the public profile) */}
      <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--edit-panel-bg)", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Colors</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
          Username colors you&apos;ve unlocked. Your highest color is used on your name; this list is only shown here.
        </div>
        {(props.colorHistory?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>White (default) — no color purchases yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            {(props.colorHistory ?? []).map((c) => (
              <div
                key={`${c.name}-${c.purchasedAt}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
              >
                <span style={{ fontWeight: 800 }}>{c.name}</span>
                <span style={{ opacity: 0.65, fontSize: 12 }}>
                  unlocked {new Date(c.purchasedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EMAIL */}
      <div id="email" style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--edit-panel-bg)", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>
          {verified ? "Change email" : "Email verification"}
        </div>

        {verified ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "var(--success)", fontSize: 13 }}>
              Verified — {new Date(props.emailVerifiedAt!).toLocaleString()}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Enter a new address, send a code, then confirm to switch.
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="New email address"
              style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}
            />
            <button
              onClick={sendCode}
              disabled={emailBusy}
              style={{
                width: "fit-content",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bid-btn-bg)",
                color: "var(--bid-btn-text)",
                fontWeight: 1000,
                cursor: emailBusy ? "not-allowed" : "pointer",
              }}
            >
              {emailBusy ? "Working..." : "Send code to new email"}
            </button>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", width: 160 }}
              />
              <button
                onClick={confirmCode}
                disabled={emailBusy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-btn-send)",
                  color: "var(--text-btn-send)",
                  fontWeight: 1000,
                  cursor: emailBusy ? "not-allowed" : "pointer",
                }}
              >
                Confirm
              </button>
            </div>
            {emailMsg && <div style={{ fontWeight: 1000 }}>{emailMsg}</div>}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}
            />
            <button
              onClick={sendCode}
              disabled={emailBusy}
              style={{
                width: "fit-content",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bid-btn-bg)",
                color: "var(--bid-btn-text)",
                fontWeight: 1000,
                cursor: emailBusy ? "not-allowed" : "pointer",
              }}
            >
              {emailBusy ? "Working..." : "Send verification code"}
            </button>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", width: 160 }}
              />
              <button
                onClick={confirmCode}
                disabled={emailBusy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-btn-send)",
                  color: "var(--text-btn-send)",
                  fontWeight: 1000,
                  cursor: emailBusy ? "not-allowed" : "pointer",
                }}
              >
                Verify
              </button>
            </div>
            {emailMsg && <div style={{ fontWeight: 1000 }}>{emailMsg}</div>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link href="/profile" style={{ fontWeight: 900 }}>
          ← Back to Profile
        </Link>
      </div>
    </main>
  );
}
