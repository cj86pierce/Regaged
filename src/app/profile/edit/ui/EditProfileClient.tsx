"use client";

import Link from "next/link";
import { useState } from "react";

export default function EditProfileClient(props: {
  initialBio: string;
  email: string;
  emailVerifiedAt: string | null;
}) {
  const [bio, setBio] = useState(props.initialBio);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState(props.email);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [verifyLink, setVerifyLink] = useState<string | null>(null);

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

  async function sendVerifyEmail() {
    setEmailBusy(true);
    setEmailMsg(null);
    setVerifyLink(null);

    const res = await fetch("/api/verify-email/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = await res.json().catch(() => ({}));
    setEmailBusy(false);

    if (!res.ok) return setEmailMsg(json?.error ?? "Failed to create verify link");

    setEmailMsg("Verification link created (beta mode). Click it below:");
    setVerifyLink(json.link ?? null);
  }

  const verified = !!props.emailVerifiedAt;

  return (
    <main style={{ padding: 12, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Edit Profile</h1>

      {/* BIO */}
      <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Bio</div>

        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={8}
          maxLength={1000}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.20)",
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
              border: "1px solid rgba(0,0,0,0.15)",
              background: saving ? "#f3f6f9" : "#111",
              color: saving ? "#111" : "#fff",
              fontWeight: 1000,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Bio"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>{bio.length}/1000</div>
          {msg && <div style={{ fontWeight: 1000 }}>{msg}</div>}
        </div>
      </div>

      {/* EMAIL VERIFICATION */}
      <div style={{ marginTop: 12, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Email Verification</div>

        {verified ? (
          <div style={{ fontWeight: 900, color: "#198754" }}>
            ✅ Verified — {new Date(props.emailVerifiedAt!).toLocaleString()}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.20)" }}
            />

            <button
              onClick={sendVerifyEmail}
              disabled={emailBusy}
              style={{
                width: "fit-content",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "linear-gradient(#ffd85a,#ffb703)",
                color: "#3a2b00",
                fontWeight: 1000,
                cursor: emailBusy ? "not-allowed" : "pointer",
              }}
            >
              {emailBusy ? "Working..." : "Verify Email"}
            </button>

            {emailMsg && <div style={{ fontWeight: 1000 }}>{emailMsg}</div>}

            {verifyLink && (
              <div style={{ wordBreak: "break-all", fontSize: 12 }}>
                <a href={verifyLink} style={{ fontWeight: 900 }}>
                  {verifyLink}
                </a>
              </div>
            )}
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
