"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

function readRef(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("ref") ?? "";
  if (/^[A-Za-z0-9]{3,24}$/.test(q)) return q;
  const match = document.cookie.match(/(?:^|;\s*)rg_ref=([^;]+)/i);
  if (!match?.[1]) return "";
  try {
    const v = decodeURIComponent(match[1]).trim();
    return /^[A-Za-z0-9]{3,24}$/.test(v) ? v : "";
  } catch {
    return "";
  }
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [refCode, setRefCode] = useState("");

  useEffect(() => {
    const ref = readRef();
    if (!ref) return;
    setRefCode(ref);
    document.cookie = `rg_ref=${encodeURIComponent(ref.toLowerCase())}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, ref: refCode || undefined }),
    });

    const data = await r.json();
    if (!r.ok) {
      setMsg(data?.error ?? "Register failed.");
      return;
    }

    await signIn("credentials", { username, password, redirect: true, callbackUrl: "/enroll" });
  }

  return (
    <main>
      <h1>Register</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
        <input placeholder="username (a-z 0-9 _)" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="password (6+ chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Create account</button>
        {msg && <p>{msg}</p>}
      </form>

      {refCode ? (
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.85, maxWidth: 420, lineHeight: 1.4 }}>
          Invited by a friend. After you verify your email and join a game, they get 5 R$.
        </p>
      ) : null}

      <p style={{ marginTop: 12 }}>
        Already have one? <Link href="/login">Login</Link>
      </p>
    </main>
  );
}
