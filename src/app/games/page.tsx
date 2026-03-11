export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function GamesPage() {
  const games = await prisma.game.findMany({
    where: { state: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, gameType: true, state: true },
  });

  return (
    <main style={{ padding: 12 }} className="gamesPage">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }} className="gamesPageLayout">
      <div>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Latest Regaged Games</h1>

      <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.75 }}>
        Anyone can spectate. Only players in a game can act.
      </div>

      <div className="gamesList" style={{ display: "grid", gap: 10 }}>
        {games.map((g) => (
          <Link
            key={g.id}
            href={`/game/${g.id}`}
            className="gamesListItem"
            style={{
              textDecoration: "none",
              color: "var(--text-primary)",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "var(--bg-card)",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 1000, minWidth: 0 }}>
              {g.gameType} #{g.number}
              <div className="gamesListItemId" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{g.id}</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>{g.state}</div>
          </Link>
        ))}

        {!games.length && (
          <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12 }}>
            No active games right now.
          </div>
        )}
      </div>
      </div>

      {/* Right sidebar */}
      <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 1000, marginBottom: 10, color: "var(--brand)" }}>Enroll in a game</div>
        <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 12 }}>Join a Fastings or Castings game and compete.</p>
        <a href="/enroll" className="theme-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: 12, borderRadius: 10 }}>
          Enroll →
        </a>
      </div>
      </div>
    </main>
  );
}
