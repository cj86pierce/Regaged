import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "What is Regaged?",
    a: (
      <>
        An online social game site with chatty multiplayer modes (Fastings, Castings, Frookies,
        Rookies), avatars, blogs, designs, and a shop. Inspired by social elimination formats — not
        affiliated with those shows or brands.
      </>
    ),
  },
  {
    q: "How do I join a game?",
    a: (
      <>
        Go to <Link href="/enroll">Enroll</Link>, pick a mode, and join the lobby. When it fills,
        the game starts automatically.
      </>
    ),
  },
  {
    q: "What’s the difference between live and Bot modes?",
    a: (
      <>
        Bot rooms use the <b>same rules</b> as the matching live mode, but with short ~2 minute
        phases and bots filling empty seats — great for practice. Live rooms are the real paced
        games with other players.
      </>
    ),
  },
  {
    q: "What are Fastings / Castings / Frookies / Rookies?",
    a: (
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        <li>
          <b>Fastings</b> — POV → nominate → vote. Free. Final 3 gets a 30-minute clock.
        </li>
        <li>
          <b>Castings</b> — longer days with keys, challenges, and point votes. Free.
        </li>
        <li>
          <b>Frookies</b> — HOH + POV, renoms, jury at the end. Yellow + T$ entry.
        </li>
        <li>
          <b>Rookies</b> — week-style days, ranking votes, secret POV. Yellow + T$ entry.
        </li>
      </ul>
    ),
  },
  {
    q: "What is Karma and R$ / T$?",
    a: (
      <>
        Karma is your standing (used for Hall of Fame ranks and some unlocks). R$ / T$ is in-game
        money for shop items, arcade minigames, and some enroll fees. Virtual currency has no
        real-world cash value.
      </>
    ),
  },
  {
    q: "What is the Hall of Fame?",
    a: (
      <>
        The <Link href="/hof">HOF</Link> ranks players by Karma. Top ranks get a small badge next to
        their name on profiles.
      </>
    ),
  },
  {
    q: "How do minigames / challenges work?",
    a: (
      <>
        In Castings and Frookies you can play day challenges for Challenge Scores. There is also a
        paid <Link href="/minigames">arcade</Link> for practice that does not affect live games.
      </>
    ),
  },
  {
    q: "Can I customize my avatar?",
    a: (
      <>
        Yes — <Link href="/profile/avatar">Customize Avatar</Link>. Buy colors in the shop, and
        equip community designs from the Designs market when you own them.
      </>
    ),
  },
  {
    q: "I found a bug or someone is cheating. What do I do?",
    a: (
      <>
        Use <Link href="/contact">Contact</Link> and include your username, the game number/link if
        relevant, and what happened.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>F.A.Q.</h1>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 18, lineHeight: 1.45 }}>
        Quick answers. Still stuck? <Link href="/contact">Contact</Link> us.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {FAQS.map((item) => (
          <div
            key={item.q}
            className="theme-sidebar-panel"
            style={{ borderRadius: 12, padding: "14px 16px" }}
          >
            <div style={{ fontWeight: 1000, fontSize: 15, marginBottom: 6 }}>{item.q}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>{item.a}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
