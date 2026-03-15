export const dynamic = "force-dynamic";

import Link from "next/link";

function GameCard({ title, desc, href, accent }: { title: string; desc: string; href: string; accent?: string }) {
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
          background: accent ?? "var(--accent-bg)",
          margin: -20,
          marginBottom: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)" }}>{title}</span>
      </div>
      <div style={{ fontWeight: 1000, fontSize: 16 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>{desc}</div>
      <div style={{ marginTop: 12, fontWeight: 1000, color: "var(--link-color)" }}>Open ▶</div>
    </Link>
  );
}

export default function EnrollHub() {
  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Enroll</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>
        Choose a game mode. Fastings, Frookies, Rookies, and Castings available.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        <GameCard title="Fastings" desc="Fast mode. POV → nominate → evict. Short phases." href="/enroll/fasting" />
        <GameCard title="Frookies" desc="Same as Fastings. For friends and newcomers." href="/enroll/frookies" />
        <GameCard title="Rookies" desc="Same as Fastings. Rookie-friendly mode." href="/enroll/rookies" />
        <GameCard title="Castings" desc="Slow mode (12-hour days). Health decay + drops (apples/keys/poison)." href="/enroll/casting" />
        <GameCard title="Fastings (Bot)" desc="60s rounds. Bots fill slots. No payouts. Practice mode." href="/enroll/fasting-bot" />
        <GameCard title="Castings (Bot)" desc="60s days. Bots fill slots. No payouts. Practice mode." href="/enroll/casting-bot" />
      </div>
    </main>
  );
}
