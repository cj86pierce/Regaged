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
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 1000, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

function GameBtn({ href, label, sub }: { href: string; label: string; sub: string }) {
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
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>
    </Link>
  );
}

export default async function RightRail() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

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
      game: { select: { number: true, gameType: true, state: true } },
    },
  });

  return (
    <Card title="My Active Games">
      {myGames.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {myGames.map((g) => (
            <GameBtn
              key={g.gameId}
              href={`/game/${g.gameId}`}
              label={`${g.game.gameType} #${g.game.number}`}
              sub={`${g.gameId}`}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No active games.</div>
      )}
    </Card>
  );
}
