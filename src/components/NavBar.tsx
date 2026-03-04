"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type SteamMe = { userId: string; username: string } | null;

export default function NavBar() {
  const { data: session, status } = useSession();
  const [steamMe, setSteamMe] = useState<SteamMe>(null);
  const loggedIn = !!session?.user || !!steamMe;

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
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(169, 207, 232, 0.92)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
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

        <div className="navLinks" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Community
          </Link>
          <Link href="/" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Groups
          </Link>
          <Link href="/games" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Games
          </Link>
          <Link href="/blogs" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Blogs
          </Link>
          <Link href="/designs" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Designs
          </Link>
          <Link href="/shop" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
           Shop
          </Link>

          

          <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.15)" }} />

          {status === "loading" && !steamMe ? (
            <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}>Loading…</span>
          ) : !loggedIn ? (
            <>
              <Link href="/register" style={{ color: "#123", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                Register
              </Link>
              <Link href="/login" style={{ color: "#123", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                Login
              </Link>
            </>
          ) : steamMe && !session?.user ? (
            <>
              <Link href="/profile" style={{ color: "#123", textDecoration: "none", fontWeight: 900, fontSize: 13 }}>
                Profile
              </Link>
              <button
                type="button"
                onClick={logoutSteam}
                style={{
                  background: "none",
                  border: "none",
                  color: "#123",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/profile" style={{ color: "#123", textDecoration: "none", fontWeight: 900, fontSize: 13 }}>
                Profile
              </Link>
              <Link href="/logout" style={{ color: "#123", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                Logout
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
