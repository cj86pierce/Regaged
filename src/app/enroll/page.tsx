export const dynamic = "force-dynamic";

import Link from "next/link";

const BLUE_ACCENT = "#a9cfe8";
const BLUE_BUTTON = "linear-gradient(#d6eaf6, #a9cfe8)";
const PINK_ACCENT = "#f48fb1";
const PINK_BUTTON = "linear-gradient(#f8bbd9, #f48fb1)";
const GREEN_ACCENT = "#66bb6a";
const GREEN_BUTTON = "linear-gradient(#a5d6a7, #66bb6a)";

function GameCard({
  title,
  desc,
  href,
  accent,
}: {
  title: string;
  desc: string;
  href: string;
  accent: "blue" | "pink" | "green";
}) {
  const headerBg =
    accent === "pink" ? PINK_ACCENT : accent === "green" ? GREEN_ACCENT : BLUE_ACCENT;
  const titleColor =
    accent === "pink" ? "#5a2a3a" : accent === "green" ? "#1b3d1f" : "#0b2b66";
  const linkColor =
    accent === "pink" ? "#8b3a52" : accent === "green" ? "#2e7d32" : "#0b5ed7";
  const btnBg =
    accent === "pink" ? PINK_BUTTON : accent === "green" ? GREEN_BUTTON : BLUE_BUTTON;

  return (
    <Link href={href} className="enrollCard">
      <div
        style={{
          minHeight: 72,
          background: headerBg,
          margin: -18,
          marginBottom: 14,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontWeight: 1000, fontSize: 17, color: titleColor }}>{title}</span>
      </div>
      <div style={{ marginTop: 0, fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{desc}</div>
      <div
        style={{
          marginTop: 12,
          fontWeight: 1000,
          color: linkColor,
          padding: "10px 12px",
          borderRadius: 4,
          background: btnBg,
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
        Pick a mode. Free: Fastings & Castings. Yellow + fee: Frookies, Rookies & Survivor. Bot rooms use the same rules with ~2 minute phases and bots filling seats.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Free modes</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard title="Fastings" desc="Fast rounds. POV → nominate → evict. Final 3 gets a 12-hour clock." href="/enroll/fasting" accent="blue" />
            <GameCard title="Castings" desc="12-hour days. Keys, apples, challenges, and votes." href="/enroll/casting" accent="blue" />
            <GameCard title="Fastings (Bot)" desc="Same Fastings rules, ~2 min phases. Bots fill seats." href="/enroll/fasting-bot" accent="blue" />
            <GameCard title="Castings (Bot)" desc="Same Castings rules, ~2 min days. Bots fill seats." href="/enroll/casting-bot" accent="blue" />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Yellow required</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Frookies"
              desc="T$10 entry. HOH + POV. Jury (9th–3rd) picks the winner."
              href="/enroll/frookies"
              accent="pink"
            />
            <GameCard
              title="Rookies"
              desc="T$15 entry. Week-long. Ranking votes + secret POV."
              href="/enroll/rookies"
              accent="pink"
            />
            <GameCard title="Frookies (Bot)" desc="Same Frookies rules, ~2 min phases. Bots fill seats." href="/enroll/frookies-bot" accent="pink" />
            <GameCard title="Rookies (Bot)" desc="Same Rookies rules, ~2 min days. Bots fill seats." href="/enroll/rookies-bot" accent="pink" />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Survivor</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Survivor"
              desc="T$10 entry. 20 castaways, 2 tribes, challenges, tribal council."
              href="/enroll/survivor"
              accent="green"
            />
            <GameCard
              title="Survivor (Bot)"
              desc="Same Survivor rules, ~2 min days. Bots fill seats."
              href="/enroll/survivor-bot"
              accent="green"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
