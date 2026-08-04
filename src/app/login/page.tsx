"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setBusy(false);

    if (res?.error) {
      // NextAuth often returns "CredentialsSignin"; thrown Error messages may appear in URL/query
      const msg = res.error === "CredentialsSignin" ? "Login failed." : res.error;
      setErr(msg);
      return;
    }

    window.location.href = "/enroll";
  }

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy}>
          {busy ? "…" : "Login"}
        </button>
        {err && <p style={{ color: "var(--text-error)" }}>{err}</p>}
      </form>

      <p style={{ marginTop: 12 }}>
        No account? <Link href="/register">Register</Link>
      </p>
    </main>
  );
}
