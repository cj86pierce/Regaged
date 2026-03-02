export const dynamic = "force-dynamic";

import Link from "next/link";

function GameCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "#111",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 14,
        background: "#fff",
        padding: 16,
        display: "block",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 1000, fontSize: 18 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>{desc}</div>
      <div style={{ marginTop: 12, fontWeight: 1000, color: "#0b5ed7" }}>Open ▶</div>
    </Link>
  );
}

export default function EnrollHub() {
  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Enroll</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
        More games soon. Fastings + Castings available.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <GameCard
          title="Fastings"
          desc="Fast mode. POV → nominate → evict. Short phases."
          href="/enroll/fasting"
        />
        <GameCard
          title="Castings"
          desc="Slow mode (12-hour days). Health decay + drops (apples/keys/poison)."
          href="/enroll/casting"
        />
        <GameCard
          title="Fastings (Bot)"
          desc="60s rounds. Bots fill slots. No payouts. Practice mode."
          href="/enroll/fasting-bot"
        />
        <GameCard
          title="Castings (Bot)"
          desc="60s days. Bots fill slots. No payouts. Practice mode."
          href="/enroll/casting-bot"
        />
      </div>
    </main>
  );
}
