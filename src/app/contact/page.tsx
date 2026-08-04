import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Contact</h1>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 18, lineHeight: 1.45 }}>
        Bug reports, account issues, abuse reports, and general questions.
      </p>

      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 18, lineHeight: 1.55, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}>
          Email{" "}
          <a href="mailto:support@regaged.com" style={{ fontWeight: 900 }}>
            support@regaged.com
          </a>{" "}
          and include:
        </p>
        <ul>
          <li>Your Regaged username</li>
          <li>What you were doing (page / game mode)</li>
          <li>Game number or link if it is about a live game</li>
          <li>Screenshots or the approximate time (helpful for bugs)</li>
        </ul>
        <p>
          For rules and policies, see <Link href="/tos">Terms of Service</Link>,{" "}
          <Link href="/privacy">Privacy</Link>, and the <Link href="/faq">F.A.Q.</Link>
        </p>
        <p style={{ marginBottom: 0, opacity: 0.8, fontSize: 13 }}>
          We read mail as soon as we can; game-breaking abuse reports get priority.
        </p>
      </div>
    </main>
  );
}
