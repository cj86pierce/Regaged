"use client";

import { useState } from "react";

export default function VerifyPhonePage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/phone/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error ?? "Failed to send code");
    setStep("code");
    setMsg("Code sent!");
  }

  async function confirm() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/phone/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error ?? "Verification failed");
    setMsg("Verified! You can join games now.");
    window.location.href = "/enroll";
  }

  return (
    <main style={{ padding: 12, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Verify Phone</h1>
      <p style={{ opacity: 0.8 }}>
        During beta, phone verification is required to join games to reduce alt accounts and speed up testing.
      </p>

      {step === "phone" && (
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (E.164) e.g. +14195551234"
            style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
          <button
            disabled={busy}
            onClick={sendCode}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", fontWeight: 1000 }}
          >
            {busy ? "Sending..." : "Send Code"}
          </button>
        </div>
      )}

      {step === "code" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Sent to: <b>{phone}</b></div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
          <button
            disabled={busy}
            onClick={confirm}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", fontWeight: 1000 }}
          >
            {busy ? "Verifying..." : "Verify"}
          </button>

          <button
            disabled={busy}
            onClick={() => setStep("phone")}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-btn-disabled)", color: "var(--text-primary)", fontWeight: 900 }}
          >
            Change phone
          </button>
        </div>
      )}

      {msg && <div style={{ marginTop: 12, fontWeight: 1000 }}>{msg}</div>}
    </main>
  );
}
