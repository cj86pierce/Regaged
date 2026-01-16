export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 1000, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

function GameButton({ href, label, sub }: { href: string; label: string; sub?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "#111",
        border: "1px solid rgba(0,0,0,0.14)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 12 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>}
    </Link>
  );
}

export default async function RightRail() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  // All active games (spectate list)
  const allGames = await prisma.game.findMany({
    where: { state: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, number: true, gameType: true, state: true },
  });

  // My active games (only if logged in)
  const myGames =
    userId
      ? await prisma.gamePlayer.findMany({
          where: {
            userId,
            status: "ACTIVE",
            game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
          },
          orderBy: { joinedAt: "desc" },
          take: 10,
          select: {
            gameId: true,
            game: { select: { number: true, gameType: true, state: true } },
          },
        })
      : [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card title="My Active Games">
        {userId ? (
          myGames.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {myGames.map((g) => (
                <GameButton
                  key={g.gameId}
                  href={`/game/${g.gameId}`}
                  label={`${g.game.gameType} #${g.game.number}`}
                  sub={`(your game) · ${g.game.state.toLowerCase()}`}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No active games.</div>
          )
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Login to see your games.</div>
        )}
      </Card>

      <Card title="All Active Games">
        {allGames.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {allGames.map((g) => (
              <GameButton
                key={g.id}
                href={`/game/${g.id}`}
                label={`${g.gameType} #${g.number}`}
                sub={`${g.id}`}
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No active games right now.</div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.65 }}>
          Anyone can spectate. Only players in the game can act.
        </div>
      </Card>
    </div>
  );
}
