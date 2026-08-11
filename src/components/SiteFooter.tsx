"use client";

import Link from "next/link";
import DailyLoginCard, { openDailyLogin } from "@/components/DailyLoginCard";

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

const DAILY_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DAILY_LOGIN === "1";

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
        <div className="siteFooterRow">
          {ROW1.map((l, i) => (
            <span key={l.label} className="siteFooterLinkWrap">
              {i > 0 && <span className="siteFooterDot">·</span>}
              <Link href={l.href} className="siteFooterLink">
                {l.label}
              </Link>
            </span>
          ))}
          {DAILY_ENABLED ? (
            <span className="siteFooterLinkWrap">
              <span className="siteFooterDot">·</span>
              <button type="button" className="siteFooterLink siteFooterDaily" onClick={openDailyLogin}>
                Daily
              </button>
            </span>
          ) : null}
        </div>
        <LinkRow links={ROW2} />
        <p className="siteFooterDisclaimer">
          Regaged is an online social game site and is not affiliated with Suzanne Collins, Scholastic,
          Lionsgate Entertainment, Endemol, Big Brother, Survivor, or any other party related to the
          social games that inspired features on this site. All icons, trademarks and logos are
          property of their respective owners.
        </p>
      </div>
      {DAILY_ENABLED ? <DailyLoginCard /> : null}
    </footer>
  );
}
