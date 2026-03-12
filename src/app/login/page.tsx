"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: true,
      callbackUrl: "/enroll",
    });

    if (res?.error) setErr("Login failed.");
  }

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, maxWidth: 360 }}>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Login</button>
        {err && <p style={{ color: "var(--text-error)" }}>{err}</p>}
      </form>

      <p style={{ marginTop: 12 }}>
        No account? <Link href="/register">Register</Link>
      </p>
    </main>
  );
}
