"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CastingMiniGame from "../components/CastingMiniGame";

export default function ChallengePage() {
  const params = useParams();
  const gameId = params.id as string;

  const [data, setData] = useState<{
    meUserId: string | null;
    myScore: number;
    gameType: string;
    state: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=1&pageSize=1`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load");
    const me = json.meUserId
      ? json.players?.find((p: { userId: string }) => p.userId === json.meUserId)
      : null;
    setData({
      meUserId: json.meUserId ?? null,
      myScore: me?.castingDayMiniGameScore ?? 0,
      gameType: json.game?.gameType ?? "",
      state: json.game?.state ?? "",
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [gameId]);

  const isCasting =
    data?.gameType === "CASTING" || data?.gameType === "CASTING_BOT";
  const canPlay =
    data?.state === "ROUND_VOTE" || data?.state === "ROUND_NOMINATE";

  if (error)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson" }}>{error}</p>
        <Link href={`/game/${gameId}`}>← Back to game</Link>
      </main>
    );

  return (
    <main style={{ padding: 16, maxWidth: 500, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/game/${gameId}`}
          style={{ fontWeight: 800, textDecoration: "underline" }}
        >
          ← Back to game
        </Link>
      </div>

      {!isCasting && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>This game type does not have daily challenges.</p>
        </div>
      )}

      {isCasting && !canPlay && data && (
        <div className="theme-sidebar-panel" style={{ padding: 16 }}>
          <p>Challenges are available during voting or nomination phases.</p>
        </div>
      )}

      {isCasting && canPlay && data && (
        <CastingMiniGame
          gameId={gameId}
          meUserId={data.meUserId}
          myScore={data.myScore}
          onSubmitScore={load}
        />
      )}

      {!data && <p>Loading…</p>}
    </main>
  );
}
