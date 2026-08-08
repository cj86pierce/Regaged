export const dynamic = "force-dynamic";

import Link from "next/link";

type Accent = "blue" | "pink" | "green" | "blackGold" | "black" | "blackSilver" | "goldNavy";

const ACCENTS: Record<
  Accent,
  { headerBg: string; titleColor: string; linkColor: string; btnBg: string }
> = {
  blue: {
    headerBg: "#a9cfe8",
    titleColor: "#0b2b66",
    linkColor: "#0b5ed7",
    btnBg: "linear-gradient(#d6eaf6, #a9cfe8)",
  },
  pink: {
    headerBg: "#f48fb1",
    titleColor: "#5a2a3a",
    linkColor: "#8b3a52",
    btnBg: "linear-gradient(#f8bbd9, #f48fb1)",
  },
  green: {
    headerBg: "#66bb6a",
    titleColor: "#1b3d1f",
    linkColor: "#2e7d32",
    btnBg: "linear-gradient(#a5d6a7, #66bb6a)",
  },
  // Hunger Games
  blackGold: {
    headerBg: "linear-gradient(135deg, #111 0%, #1a1a1a 55%, #c9a227 160%)",
    titleColor: "#f0d78c",
    linkColor: "#c9a227",
    btnBg: "linear-gradient(#2a2a2a, #111)",
  },
  // Duel
  black: {
    headerBg: "#111111",
    titleColor: "#f5f5f5",
    linkColor: "#e0e0e0",
    btnBg: "linear-gradient(#2a2a2a, #111)",
  },
  // Challenge
  blackSilver: {
    headerBg: "linear-gradient(135deg, #111 0%, #1a1a1a 50%, #c0c0c0 160%)",
    titleColor: "#e8e8e8",
    linkColor: "#b0b0b0",
    btnBg: "linear-gradient(#3a3a3a, #1a1a1a)",
  },
  // Stars
  goldNavy: {
    headerBg: "linear-gradient(135deg, #0a1628 0%, #13294b 55%, #c9a227 160%)",
    titleColor: "#f0d78c",
    linkColor: "#c9a227",
    btnBg: "linear-gradient(#1a3358, #0a1628)",
  },
};

function GameCard({
  title,
  desc,
  href,
  accent,
  soon,
}: {
  title: string;
  desc: string;
  href?: string;
  accent: Accent;
  soon?: boolean;
}) {
  const a = ACCENTS[accent];
  const inner = (
    <>
      <div
        style={{
          minHeight: 72,
          background: a.headerBg,
          margin: -18,
          marginBottom: 14,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontWeight: 1000, fontSize: 17, color: a.titleColor }}>{title}</span>
      </div>
      <div style={{ marginTop: 0, fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{desc}</div>
      <div
        style={{
          marginTop: 12,
          fontWeight: 1000,
          color: a.linkColor,
          padding: "10px 12px",
          borderRadius: 4,
          background: a.btnBg,
          border: "1px solid var(--border)",
          display: "block",
          textAlign: "center",
        }}
      >
        {soon ? "Coming soon" : "Open ▶"}
      </div>
    </>
  );

  if (soon || !href) {
    return (
      <div className="enrollCard" style={{ opacity: 0.95, cursor: "default" }}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className="enrollCard">
      {inner}
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
        Pick a mode. Free: Fastings & Castings. Yellow + fee: Frookies, Rookies & Survivor. Live lobbies bot-fill after 15 minutes if seats are still open. Practice bot rooms fill instantly.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Free modes</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard title="Fastings" desc="Fast rounds. POV → nominate → evict. Bot-fills empty seats after 15 min." href="/enroll/fasting" accent="blue" />
            <GameCard title="Castings" desc="12-hour days. Keys, apples, challenges. Bot-fills empty seats after 15 min." href="/enroll/casting" accent="blue" />
            <GameCard title="Fastings (Bot)" desc="Same Fastings rules, ~2 min phases. Bots fill instantly." href="/enroll/fasting-bot" accent="blue" />
            <GameCard title="Castings (Bot)" desc="Same Castings rules, ~2 min days. Bots fill instantly." href="/enroll/casting-bot" accent="blue" />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Yellow required</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Frookies"
              desc="T$10 entry. HOH + POV. Bot-fills empty seats after 15 min."
              href="/enroll/frookies"
              accent="pink"
            />
            <GameCard
              title="Rookies"
              desc="T$15 entry. Ranking votes + secret POV. Bot-fills empty seats after 15 min."
              href="/enroll/rookies"
              accent="pink"
            />
            <GameCard title="Frookies (Bot)" desc="Same Frookies rules, ~2 min phases. Bots fill instantly." href="/enroll/frookies-bot" accent="pink" />
            <GameCard title="Rookies (Bot)" desc="Same Rookies rules, ~2 min days. Bots fill instantly." href="/enroll/rookies-bot" accent="pink" />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Survivor</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Survivor"
              desc="T$10 entry. 20 castaways, 2 tribes. Bot-fills empty seats after 15 min."
              href="/enroll/survivor"
              accent="green"
            />
            <GameCard
              title="Survivor (Bot)"
              desc="Same Survivor rules, ~2 min days. Bots fill instantly."
              href="/enroll/survivor-bot"
              accent="green"
            />
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 1000, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>Coming later</div>
          <div className="enrollGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            <GameCard
              title="Hunger Games"
              desc="Black & gold. Arena competition — coming soon."
              accent="blackGold"
              soon
            />
            <GameCard
              title="Duel"
              desc="Black. One-on-one showdown — coming soon."
              accent="black"
              soon
            />
            <GameCard
              title="Challenge"
              desc="Black & silver. Head-to-head challenges — coming soon."
              accent="blackSilver"
              soon
            />
            <GameCard
              title="Stars"
              desc="Gold & navy. Celebrity / spectate mode — coming soon."
              accent="goldNavy"
              soon
            />
          </div>
        </section>
      </div>
    </main>
  );
}
