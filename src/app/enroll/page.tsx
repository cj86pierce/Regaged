export const dynamic = "force-dynamic";

import Link from "next/link";

const PINK_ACCENT = "#f48fb1";
const PINK_BUTTON = "linear-gradient(#f8bbd9, #f48fb1)";

function GameCard({ title, desc, href, pink }: { title: string; desc: string; href: string; pink?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--bg-card)",
        padding: 20,
        display: "block",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          minHeight: 80,
          background: pink ? PINK_ACCENT : "var(--accent-bg)",
          margin: -20,
          marginBottom: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontWeight: 1000, fontSize: 18, color: pink ? "#5a2a3a" : "var(--brand)" }}>{title}</span>
      </div>
      <div style={{ fontWeight: 1000, fontSize: 16 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>{desc}</div>
      <div
        style={{
          marginTop: 12,
          fontWeight: 1000,
          color: pink ? "#8b3a52" : "var(--link-color)",
          padding: "8px 12px",
          borderRadius: 10,
          background: pink ? PINK_BUTTON : "transparent",
          border: pink ? "1px solid rgba(0,0,0,0.1)" : "none",
          display: "inline-block",
        }}
      >
        Open ▶
      </div>
    </Link>
  );
}

export default function EnrollHub() {
  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Enroll</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>
        Choose a game mode. Row 1: Fastings & Castings. Row 2: Frookies & Rookies (pink).
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          <GameCard title="Fastings" desc="Fast mode. POV → nominate → evict. Short phases." href="/enroll/fasting" />
          <GameCard title="Castings" desc="Slow mode (12h days). Health decay + drops." href="/enroll/casting" />
          <GameCard title="Fastings (Bot)" desc="60s rounds. Bots fill. Practice." href="/enroll/fasting-bot" />
          <GameCard title="Castings (Bot)" desc="60s days. Bots fill. Practice." href="/enroll/casting-bot" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          <GameCard title="Frookies" desc="Yellow card required. Entrance T$10. Prizes: 1st 25 Karma + 60 T$, 2nd 3 Karma + 20 T$, 3rd–6th T$10." href="/enroll/frookies" pink />
          <GameCard title="Rookies" desc="Yellow card required. Entrance T$15. 1 week. Prizes: 1st 80 Karma + 50 T$, 2nd–10th Karma + T$." href="/enroll/rookies" pink />
          <GameCard title="Frookies (Bot)" desc="60s rounds. Bots fill. Practice." href="/enroll/frookies-bot" pink />
          <GameCard title="Rookies (Bot)" desc="60s rounds. Bots fill. Practice." href="/enroll/rookies-bot" pink />
        </div>
      </div>
    </main>
  );
}
