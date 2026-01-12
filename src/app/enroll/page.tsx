"use client";
import { useState } from "react";

export default function EnrollPage() {
  const [msg, setMsg] = useState("");
  const [gameId, setGameId] = useState<string | null>(null);

  async function refreshMyGame() {
    const r = await fetch("/api/me/game");
    const d = await r.json();
    setGameId(d.gameId);
  }

  async function enroll() {
    const r = await fetch("/api/enroll", { method: "POST" });
    const d = await r.json();
    setMsg(d.ok ? "Enrolled in Fasting" : d.error);
    await refreshMyGame();
  }

  return (
    <main style={{ padding: 12 }}>
      <h1>Enroll</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={enroll}>Enroll in Fasting</button>
        <button onClick={refreshMyGame}>Refresh My Game</button>
      </div>

      {msg && <p>{msg}</p>}

      {gameId && (
        <p>
          You are in game: <b>{gameId}</b>{" "}
          <a href={`/game/${gameId}`}>Go to game</a>
        </p>
      )}
    </main>
  );
}
