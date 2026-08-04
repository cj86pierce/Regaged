import Link from "next/link";

const ROW1: { href: string; label: string }[] = [
  { href: "/contact", label: "Contact" },
  { href: "/tos", label: "TOS" },
  { href: "/privacy", label: "Privacy" },
  { href: "/faq", label: "F.A.Q." },
  { href: "/hof", label: "HOF" },
  { href: "/minigames", label: "Minigames" },
];

const ROW2: { href: string; label: string }[] = [
  { href: "/", label: "Regaged" },
  { href: "/enroll/casting", label: "Castings" },
  { href: "/enroll/fasting", label: "Fastings" },
  { href: "/enroll/frookies", label: "Frookies" },
  { href: "/enroll/rookies", label: "Rookies" },
  { href: "/shop", label: "Shop" },
  { href: "/designs", label: "Designs" },
];

function LinkRow({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="siteFooterRow">
      {links.map((l, i) => (
        <span key={l.label} className="siteFooterLinkWrap">
          {i > 0 && <span className="siteFooterDot">·</span>}
          <Link href={l.href} className="siteFooterLink">
            {l.label}
          </Link>
        </span>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <LinkRow links={ROW1} />
        <LinkRow links={ROW2} />
        <p className="siteFooterDisclaimer">
          Regaged is an online social game site and is not affiliated with Suzanne Collins, Scholastic,
          Lionsgate Entertainment, Endemol, Big Brother, Survivor, or any other party related to the
          social games that inspired features on this site. All icons, trademarks and logos are
          property of their respective owners.
        </p>
      </div>
    </footer>
  );
}
