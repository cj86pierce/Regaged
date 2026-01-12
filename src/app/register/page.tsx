"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
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

      <p style={{ marginTop: 12 }}>
        Already have one? <Link href="/login">Login</Link>
      </p>
    </main>
  );
}
