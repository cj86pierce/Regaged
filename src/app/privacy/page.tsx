import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 18 }}>Last updated: August 2026</p>

      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 18, lineHeight: 1.55, fontSize: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 1000 }}>1. What we collect</h2>
        <ul>
          <li>
            <b>Account info</b> — username, password hash, optional email / phone for verification,
            optional Steam ID if you link Steam
          </li>
          <li>
            <b>Gameplay data</b> — enrollments, chat in games, votes, scores, avatar/design choices,
            shop activity
          </li>
          <li>
            <b>Technical data</b> — basic logs needed to run and secure the site (e.g. request
            timing, error reports)
          </li>
        </ul>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>2. How we use it</h2>
        <ul>
          <li>Operate accounts, games, shops, and community features</li>
          <li>Verify email/phone when those features are enabled</li>
          <li>Prevent abuse, cheating, and spam</li>
          <li>Improve performance and fix bugs</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>3. Sharing</h2>
        <p>
          We may use infrastructure providers (hosting, database, email/SMS delivery) that process
          data only to provide those services. We may disclose information if required by law or to
          protect the service and players from harm or abuse.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>4. Public information</h2>
        <p>
          Usernames, profiles, avatars, blogs, designs, Hall of Fame ranks, and similar content you
          choose to share are visible to other players as part of the social game experience.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>5. Retention</h2>
        <p>
          We keep account and gameplay records while your account is active and as needed for
          security, disputes, and legal obligations. You can ask about account deletion via{" "}
          <Link href="/contact">Contact</Link>.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>6. Security</h2>
        <p>
          We use reasonable measures to protect accounts (e.g. hashed passwords, access controls).
          No online service is perfectly secure — use a strong unique password.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>7. Kids</h2>
        <p>
          Regaged is not directed at children under 13. If you believe a child created an account,
          contact us and we will take appropriate action.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>8. Changes</h2>
        <p>
          We may update this Privacy Policy. Continued use after changes means you accept the
          updated policy.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>9. Contact</h2>
        <p>
          Privacy questions: <Link href="/contact">Contact</Link>.
        </p>
      </div>
    </main>
  );
}
