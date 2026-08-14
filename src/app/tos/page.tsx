import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TosPage() {
  return (
    <main className="pageShell" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Terms of Service</h1>
      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 18 }}>Last updated: August 2026</p>

      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 18, lineHeight: 1.55, fontSize: 14 }}>
        <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 1000 }}>1. Acceptance</h2>
        <p>
          By creating an account or using Regaged, you agree to these Terms. If you do not agree, do
          not use the site.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>2. The service</h2>
        <p>
          Regaged is an online social game platform with chat, profiles, shops, designs, and
          multiplayer game modes. Features may change, pause, or end at any time.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>3. Accounts</h2>
        <p>
          You are responsible for your account, password, and activity. Do not share accounts, create
          accounts for others without permission, or use bots/automation that interfere with fair
          play.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>4. Conduct</h2>
        <p>Do not:</p>
        <ul>
          <li>Harass, threaten, or dox other players</li>
          <li>Post illegal, sexual involving minors, or grossly abusive content</li>
          <li>Cheat, exploit bugs for unfair advantage, or spam</li>
          <li>Impersonate staff or other players</li>
          <li>Scrape, attack, or disrupt the service</li>
        </ul>
        <p>We may warn, mute, suspend, or ban accounts that break these rules.</p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>5. Virtual currency & items</h2>
        <p>
          In-game currency (including R$ / T$), colors, designs, and other items have no real-world
          cash value unless we expressly say otherwise. Purchases and awards are non-refundable
          except where required by law. We may adjust balances or revoke items obtained through
          abuse.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>6. User content</h2>
        <p>
          You keep ownership of content you post (bios, blogs, designs, chat, etc.), but grant
          Regaged a license to host, display, and moderate it as needed to run the site. Do not post
          content you do not have rights to share.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>7. No affiliation</h2>
        <p>
          Regaged is not affiliated with Suzanne Collins, Scholastic, Lionsgate, Endemol, Big
          Brother, Survivor, or other parties related to the social games that inspired features
          here. All trademarks belong to their owners.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>8. Disclaimer</h2>
        <p>
          The service is provided “as is.” We do not guarantee uninterrupted or error-free
          operation. To the fullest extent allowed by law, Regaged is not liable for indirect or
          consequential damages arising from use of the site.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>9. Changes</h2>
        <p>
          We may update these Terms. Continued use after changes means you accept the updated
          Terms. Material changes may also be noted on the site.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 1000 }}>10. Contact</h2>
        <p>
          Questions about these Terms: see <Link href="/contact">Contact</Link>.
        </p>
      </div>
    </main>
  );
}
