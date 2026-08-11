"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type SteamMe = { userId: string; username: string; isOwner?: boolean; isAdmin?: boolean } | null;

const DROP_LINKS: { href: string; label: string; note?: string }[] = [
  { href: "/blogs", label: "Community Blogs" },
  { href: "/games", label: "Games" },
  { href: "/shop", label: "Shop" },
  { href: "/enroll", label: "Enroll" },
  { href: "/designs", label: "Designs" },
  { href: "/contact", label: "Ask Me" },
  { href: "/hof", label: "HoF", note: "The Hall of Fame" },
];

export default function NavBar() {
  const { data: session, status } = useSession();
  const [steamMe, setSteamMe] = useState<SteamMe>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const [isStaffFlag, setIsStaffFlag] = useState(false);
  const [staffLabel, setStaffLabel] = useState<"Owner" | "Admin">("Owner");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loggedIn = !!session?.user || !!steamMe;
  const sessionUser = session?.user as
    | { isOwner?: boolean; isAdmin?: boolean; name?: string | null }
    | undefined;
  const showStaff =
    isStaffFlag ||
    !!sessionUser?.isOwner ||
    !!sessionUser?.isAdmin ||
    !!steamMe?.isOwner ||
    !!steamMe?.isAdmin;
  const displayName =
    steamMe?.username || sessionUser?.name || session?.user?.name || "Player";

  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/dms/unread-count", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d != null && setDmUnread(d.unread ?? 0))
      .catch(() => {});
  }, [loggedIn, pathname]);

  useEffect(() => {
    fetch("/api/me/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setIsStaffFlag(!!d.isStaff || !!d.isOwner || !!d.isAdmin);
        setStaffLabel(d.isOwner ? "Owner" : d.isAdmin ? "Admin" : "Owner");
        if (!session?.user) {
          setSteamMe({
            userId: d.userId,
            username: d.username,
            isOwner: !!d.isOwner,
            isAdmin: !!d.isAdmin,
          });
        }
      })
      .catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function logoutSteam() {
    document.cookie = "regaged_token=; path=/; max-age=0";
    window.location.reload();
  }

  return (
    <header className="tgNav">
      <div className="tgNavInner">
        <Link href="/" className="tgNavBrand">
          Regaged
        </Link>

        <nav className="tgNavLinks" aria-label="Primary">
          <Link href="/" className="tgNavLink tgNavDesktopOnly">
            Community
          </Link>
          <Link href="/games" className="tgNavLink tgNavDesktopOnly">
            Games
          </Link>
          <Link href="/designs" className="tgNavLink tgNavDesktopOnly">
            Designs
          </Link>
          {showStaff ? (
            <Link href="/owner" className="tgNavLink tgNavDesktopOnly">
              {staffLabel}
            </Link>
          ) : null}

          {status === "loading" && !steamMe ? (
            <span className="tgNavMuted tgNavDesktopOnly">…</span>
          ) : !loggedIn ? (
            <>
              <Link href="/register" className="tgNavLink tgNavDesktopOnly">
                Register
              </Link>
              <Link href="/login" className="tgNavLink tgNavDesktopOnly">
                Login
              </Link>
            </>
          ) : (
            <>
              <Link href="/dms" className="tgNavLink tgNavDm" title="Messages">
                Mail
                {dmUnread > 0 ? <span className="tgNavBadge">{dmUnread > 99 ? "99+" : dmUnread}</span> : null}
              </Link>
              <Link href="/profile" className="tgNavLink tgNavDesktopOnly">
                Profile
              </Link>
            </>
          )}

          <div className="tgNavMenuWrap" ref={menuRef}>
            <button
              type="button"
              className={`tgNavMenuBtn${menuOpen ? " open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="tgNavChevron" aria-hidden>
                ▾
              </span>
            </button>

            {menuOpen ? (
              <div className="tgNavDropdown" role="menu">
                <div className="tgNavDropWelcome">
                  {loggedIn ? (
                    <>
                      <div className="tgNavDropHi">Welcome, {displayName}</div>
                      <div className="tgNavDropAuth">
                        <Link href="/profile" role="menuitem">
                          Profile
                        </Link>
                        {steamMe && !session?.user ? (
                          <button type="button" onClick={logoutSteam} role="menuitem">
                            Logout
                          </button>
                        ) : (
                          <Link href="/logout" role="menuitem">
                            Logout
                          </Link>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="tgNavDropHi">Welcome to Regaged:</div>
                      <div className="tgNavDropAuth">
                        <Link href="/register" role="menuitem">
                          Register
                        </Link>
                        <Link href="/login" role="menuitem">
                          Login
                        </Link>
                      </div>
                    </>
                  )}
                </div>

                <div className="tgNavDropList">
                  {DROP_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="tgNavDropItem" role="menuitem">
                      <span className="label">{l.label}</span>
                      {l.note ? <span className="note">{l.note}</span> : null}
                    </Link>
                  ))}
                  {showStaff ? (
                    <Link href="/owner" className="tgNavDropItem" role="menuitem">
                      <span className="label">{staffLabel}</span>
                      <span className="note">Staff panel</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
