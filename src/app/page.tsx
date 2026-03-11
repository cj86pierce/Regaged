export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  let me: { username: string; karma: number; tMoney: number; pMoney: number } | null = null;
  let activeGameId: string | null = null;

  try {
    const userId = await getCurrentUserIdFromHeaders();

    if (userId) {
      me = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, karma: true, tMoney: true, pMoney: true },
      }) ?? null;

      activeGameId =
        (
          await prisma.gamePlayer.findFirst({
            where: {
              userId,
              status: "ACTIVE",
              game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
            },
            select: { gameId: true },
          })
        )?.gameId ?? null;
    }
  } catch (e) {
    console.error("HomePage data fetch failed:", e);
  }

  return (
    <main style={{ padding: 12 }}>
      <div className="theme-card-hero">
        <div style={{ padding: 18 }}>
          <div className="homeGrid" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, alignItems: "start" }}>
            {/* Left hero */}
            <div>
              <div style={{ color: "var(--brand)", fontWeight: 1000, fontSize: 28, letterSpacing: -0.3 }}>
                Regaged
              </div>

              <div className="theme-text-secondary" style={{ marginTop: 6, maxWidth: 560, lineHeight: 1.35, fontSize: 13 }}>
                A reality-game social site — currently in <b>beta</b>. Expect bugs. More games soon.
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/enroll" className="theme-btn-primary">
                  Enroll ▶
                </Link>
                <Link href="/shop" className="theme-btn-secondary">
                  Shop
                </Link>
                <div className="theme-text-muted" style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
                  ✅ Fastings playable · 🧪 More modes later
                </div>
              </div>
            </div>

            {/* Right participate */}
            <div className="theme-panel">
              <div className="theme-text-primary" style={{ fontWeight: 1000, textAlign: "center", marginBottom: 10 }}>Participate!</div>
              <Link href="/enroll" className="theme-btn-primary" style={{ display: "block", textAlign: "center" }}>
                Enroll now ▶
              </Link>

              {me ? (
                <div className="theme-text-secondary" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.4 }}>
                  <div>Logged in as <b className="theme-username">{me.username}</b></div>
                  <div>Karma: <b>{me.karma}</b> · R$: <b>{me.tMoney}</b></div>
                  <div>Premium <b>{me.pMoney}</b> P$</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href="/profile" className="theme-link" style={{ fontSize: 12 }}>Profile</Link>
                    {activeGameId && (
                      <Link href={`/game/${activeGameId}`} className="theme-link" style={{ fontSize: 12 }}>Go to game</Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="theme-text-secondary" style={{ marginTop: 10, fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                  New here? <Link href="/register" className="theme-link">Register</Link> or <Link href="/login" className="theme-link">Login</Link>.
                </div>
              )}

              <div className="theme-text-muted" style={{ marginTop: 10, fontSize: 12 }}>
                More games soon. Fastings is the main mode for now.
              </div>
            </div>
          </div>

          {/* Regaged shop panels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
            <Link href="/shop/colors" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", textDecoration: "none", color: "inherit", textAlign: "center" }}>
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Color Shop</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>Level up</div>
            </Link>
            <Link href="/shop/auctions" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", textDecoration: "none", color: "inherit", textAlign: "center" }}>
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Auctions</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>Bid on designs</div>
            </Link>
            <Link href="/enroll" style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", textDecoration: "none", color: "inherit", textAlign: "center" }}>
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Enroll</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>Join a game</div>
            </Link>
          </div>

          {/* Simple banner - dark in both themes, red tint in dark mode */}
          <div
            className="home-banner"
            style={{
              marginTop: 14,
              borderRadius: 12,
              overflow: "hidden",
              minHeight: 100,
              position: "relative",
            }}
          >
            <div className="home-banner-overlay" style={{ position: "absolute", inset: 0, opacity: 0.22, background: "radial-gradient(circle at 30% 20%, #ffffff, transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px", flexWrap: "wrap", gap: 8 }}>
              <div style={{ color: "#fff", fontWeight: 1000, fontSize: "clamp(20px, 6vw, 32px)", letterSpacing: -0.4 }}>
                FASTINGS
                <div style={{ fontSize: 12, opacity: 0.85 }}>nominate · evict · alliances</div>
              </div>
              <div style={{ color: "#ffeb3b", fontWeight: 1000, fontSize: 16, textAlign: "right" }}>
                Beta build
                <div style={{ fontSize: 12, opacity: 0.9 }}>bugs expected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer inside card */}
        <div className="theme-text-muted" style={{ padding: 14, borderTop: "1px solid var(--border)", fontSize: 12 }}>
          Regaged · private beta
        </div>
      </div>
    </main>
  );
}
