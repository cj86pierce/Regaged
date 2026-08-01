export const dynamic = "force-dynamic";

import Link from "next/link";

const PINK_ACCENT = "#f48fb1";
const PINK_BUTTON = "linear-gradient(#f8bbd9, #f48fb1)";

function GameCard({
  title,
  desc,
  href,
  pink,
}: {
  title: string;
  desc: string;
  href: string;
  pink?: boolean;
}) {
  return (
    <Link href={href} className="enrollCard">
      <div
        style={{
          minHeight: 72,
          background: pink ? PINK_ACCENT : "var(--accent-bg)",
          margin: -18,
          marginBottom: 14,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontWeight: 1000, fontSize: 17, color: pink ? "#5a2a3a" : "var(--brand)" }}>{title}</span>
      </div>
      <div style={{ fontWeight: 1000, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>{desc}</div>
      <div
        style={{
          marginTop: 12,
          fontWeight: 1000,
          color: pink ? "#8b3a52" : "var(--link-color)",
          padding: "10px 12px",
          borderRadius: 4,
          background: pink ? PINK_BUTTON : "var(--bg-btn-disabled)",
          border: "1px solid var(--border)",
          display: "block",
          textAlign: "center",
        }}
      >
        Open ▶
      </div>
    </Link>
  );
}

export default function EnrollHub() {
  return (
    <main className="pageShell">
      <h1 style={{ marginTop: 0, marginBottom: 6, color: "var(--brand)", fontSize: "clamp(22px, 5vw, 28px)" }}>
        Enroll
      </h1>
      <div className="theme-text-muted" style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
        Pick a mode. Free: Fastings & Castings. Yellow + fee: Frookies & Rookies. Bot rooms are for practice.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Free modes</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard title="Fastings" desc="Fast rounds. POV → nominate → evict. Final 3 gets a 12-hour clock." href="/enroll/fasting" />
            <GameCard title="Castings" desc="12-hour days. Keys, apples, challenges, and votes." href="/enroll/casting" />
            <GameCard title="Fastings (Bot)" desc="Short rounds. Bots fill the lobby. Practice." href="/enroll/fasting-bot" />
            <GameCard title="Castings (Bot)" desc="Short days. Bots fill. Practice drops & votes." href="/enroll/casting-bot" />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Yellow required</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Frookies"
              desc="T$10 entry. HOH + POV. Jury (9th–3rd) picks the winner."
              href="/enroll/frookies"
              pink
            />
            <GameCard
              title="Rookies"
              desc="T$15 entry. Week-long. Ranking votes + secret POV."
              href="/enroll/rookies"
              pink
            />
            <GameCard title="Frookies (Bot)" desc="Short rounds. Bots fill. Practice." href="/enroll/frookies-bot" pink />
            <GameCard title="Rookies (Bot)" desc="Short rounds. Bots fill. Practice." href="/enroll/rookies-bot" pink />
          </div>
        </section>
      </div>
    </main>
  );
}
