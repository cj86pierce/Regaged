import Link from "next/link";
import { getHofTop, HOF_SIZE } from "@/lib/hof";
import HofBadge, { formatHofRank, hofBadgeStyle } from "@/components/HofBadge";

export const dynamic = "force-dynamic";

export default async function HofPage() {
  const entries = await getHofTop(HOF_SIZE);

  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Hall of Fame</h1>
      <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.45, marginBottom: 16 }}>
        Top {HOF_SIZE} players by <b>Karma</b>. Ranks show as a small badge next to names on
        profiles — gold, silver, and bronze for the podium.
      </p>

      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "64px 1fr 120px",
            gap: 8,
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 900,
            opacity: 0.7,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span>Rank</span>
          <span>Player</span>
          <span style={{ textAlign: "right" }}>Karma</span>
        </div>

        {entries.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, opacity: 0.7 }}>No players yet.</div>
        )}

        {entries.map((e) => {
          const style = hofBadgeStyle(e.rank);
          return (
            <Link
              key={e.userId}
              href={`/u/${encodeURIComponent(e.username.toLowerCase())}`}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr 120px",
                gap: 8,
                padding: "10px 14px",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid var(--border)",
                background: e.rank <= 3 ? "color-mix(in srgb, var(--accent-bg) 35%, transparent)" : undefined,
              }}
            >
              <span>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    ...style,
                  }}
                >
                  {formatHofRank(e.rank)}
                </span>
              </span>
              <span style={{ fontWeight: e.rank <= 3 ? 1000 : 800, display: "inline-flex", alignItems: "center" }}>
                {e.username}
                <HofBadge rank={e.rank} />
              </span>
              <span style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {e.karma.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
