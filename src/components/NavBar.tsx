"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/ThemeProvider";

type SteamMe = { userId: string; username: string } | null;

export default function NavBar() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const [steamMe, setSteamMe] = useState<SteamMe>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const loggedIn = !!session?.user || !!steamMe;

  const pathname = usePathname();
  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/dms/unread-count", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d != null && setDmUnread(d.unread ?? 0))
      .catch(() => {});
  }, [loggedIn, pathname]);

  // When not using NextAuth session (e.g. Steam client with cookie), check /api/me/session
  useEffect(() => {
    if (session?.user) return;
    fetch("/api/me/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSteamMe({ userId: d.userId, username: d.username }))
      .catch(() => {});
  }, [session?.user]);

  function logoutSteam() {
    document.cookie = "regaged_token=; path=/; max-age=0";
    window.location.reload();
  }

  return (
    <div className="navBar">
      <div
        className="navInner"
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="navLogo" style={{ fontWeight: 1000, fontSize: 22, letterSpacing: -0.3 }}>
            Regaged<span style={{ opacity: 0.7 }}>🎞️</span>
          </div>
        </Link>

        <div className="navLinks">
          <Link href="/" className="navLink">
            Community
          </Link>
          <Link href="/" className="navLink">Groups</Link>
          <Link href="/games" className="navLink">Games</Link>
          <Link href="/blogs" className="navLink">Blogs</Link>
          <Link href="/designs" className="navLink">Designs</Link>
          <Link href="/shop" className="navLink">Shop</Link>

          <div className="navDivider" />

          <button
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="navThemeBtn"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          <div className="navDivider" />

          {loggedIn && (
            <Link href="/dms" className="navLink" title="Messages" style={{ position: "relative", paddingLeft: 4, paddingRight: 4 }}>
              ✉️
              {dmUnread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "var(--brand)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {dmUnread > 99 ? "99+" : dmUnread}
                </span>
              )}
            </Link>
          )}

          {status === "loading" && !steamMe ? (
            <span className="navLoading">Loading…</span>
          ) : !loggedIn ? (
            <>
              <Link href="/register" className="navLink navLinkBold">Register</Link>
              <Link href="/login" className="navLink navLinkBold">Login</Link>
            </>
          ) : steamMe && !session?.user ? (
            <>
              <Link href="/profile" className="navLink navLinkBold">Profile</Link>
              <button type="button" onClick={logoutSteam} className="navLogoutBtn">Logout</button>
            </>
          ) : (
            <>
              <Link href="/profile" className="navLink navLinkBold">Profile</Link>
              <Link href="/logout" className="navLink navLinkBold">Logout</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
