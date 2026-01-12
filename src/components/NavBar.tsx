"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function NavBar() {
  const { data: session, status } = useSession();
  const loggedIn = !!session?.user;

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
          <div style={{ fontWeight: 1000, fontSize: 22, letterSpacing: -0.3 }}>
            Tengaged<span style={{ opacity: 0.7 }}>🎞️</span>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Community
          </Link>
          <Link href="/" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Groups
          </Link>
          <Link href="/enroll" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Games
          </Link>
          <Link href="/" style={{ color: "#123", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
            Designs
          </Link>

          <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.15)" }} />

          {status === "loading" ? (
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
