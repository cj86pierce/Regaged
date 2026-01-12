import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const metadata: Metadata = {
  title: "Tengaged (Remake)",
  description: "Reality social game remake",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const loggedIn = !!session?.user;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          background: "linear-gradient(#a9cfe8, #d6eaf6 260px, #f5f7fb 900px)",
          color: "#111",
        }}
      >
        {/* Top nav */}
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 1000, fontSize: 22, letterSpacing: -0.3 }}>
                  Tengaged<span style={{ opacity: 0.7 }}>🎞️</span>
                </div>
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

              {!loggedIn ? (
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

        {/* Page content */}
        <div style={{ padding: "16px 12px 40px" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
