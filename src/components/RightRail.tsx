export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="theme-card">
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 1000, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

function GameBtn({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link href={href} className="theme-game-btn">
      <div style={{ fontWeight: 1000, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>
    </Link>
  );
}

export default async function RightRail() {
  try {
    const userId = await getCurrentUserIdFromHeaders();

    if (!userId) {
      return (
        <Card title="My Active Games">
          <div style={{ fontSize: 12, opacity: 0.7 }}>Login to see your games.</div>
        </Card>
      );
    }

    const myGames = await prisma.gamePlayer.findMany({
      where: {
        userId,
        status: "ACTIVE",
        game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
      },
      orderBy: { joinedAt: "desc" },
      take: 10,
      select: {
        gameId: true,
        game: { select: { number: true, gameType: true, state: true, roundNumber: true } },
      },
    });

    return (
      <Card title="My Active Games">
        {myGames.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {myGames.map((g) => {
              const game = g.game;
              if (!game) return null;
              const sub =
                game.state === "ENROLLING"
                  ? "Lobby"
                  : (game.gameType ?? "").startsWith("CASTING")
                    ? `Day ${game.roundNumber ?? 1}`
                    : `Round ${game.roundNumber ?? 1}`;
              return (
                <GameBtn
                  key={g.gameId}
                  href={`/game/${g.gameId}`}
                  label={`${game.gameType ?? "Game"} #${game.number ?? "?"}`}
                  sub={sub}
                />
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No active games.</div>
        )}
      </Card>
    );
  } catch {
    return (
      <Card title="My Active Games">
        <div style={{ fontSize: 12, opacity: 0.7 }}>Unable to load games.</div>
      </Card>
    );
  }
}
