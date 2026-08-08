"use client";

import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(json?.error ?? "Failed to send");
      return;
    }
    setOk(true);
    setMessage("");
  }

  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Contact</h1>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 18, lineHeight: 1.45 }}>
        Bug reports, account issues, abuse reports, and general questions. Messages go to the site
        owner inbox — no email required.
      </p>

      <form
        onSubmit={(e) => void submit(e)}
        className="theme-sidebar-panel"
        style={{ borderRadius: 12, padding: 18, display: "grid", gap: 12 }}
      >
        <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 13 }}>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            placeholder="Name or username"
            style={{ padding: "10px 12px", font: "inherit", fontWeight: 600 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 13 }}>
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            required
            rows={8}
            placeholder="What happened? Include game # if relevant."
            style={{ padding: "10px 12px", font: "inherit", fontWeight: 500, resize: "vertical" }}
          />
        </label>

        <button
          type="submit"
          disabled={busy || !name.trim() || !message.trim()}
          style={{
            padding: "10px 14px",
            fontWeight: 1000,
            cursor: busy ? "not-allowed" : "pointer",
            justifySelf: "start",
          }}
        >
          {busy ? "Sending…" : "Send message"}
        </button>

        {err ? <div style={{ color: "var(--text-error)", fontWeight: 800 }}>{err}</div> : null}
        {ok ? (
          <div style={{ color: "#2e7d32", fontWeight: 900 }}>
            Sent. We’ll read it in the owner inbox as soon as we can.
          </div>
        ) : null}

        <p style={{ margin: 0, opacity: 0.75, fontSize: 13, lineHeight: 1.45 }}>
          For rules and policies, see <Link href="/tos">Terms of Service</Link>,{" "}
          <Link href="/privacy">Privacy</Link>, and the <Link href="/faq">F.A.Q.</Link>
        </p>
      </form>
    </main>
  );
}
