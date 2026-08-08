export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  let me: { username: string; karma: number; tMoney: number } | null = null;
  let activeGameId: string | null = null;

  try {
    const userId = await getCurrentUserIdFromHeaders();

    if (userId) {
      me = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, karma: true, tMoney: true },
      }) ?? null;

      activeGameId =
        (
          await prisma.gamePlayer.findFirst({
            where: {
              userId,
              status: "ACTIVE",
              game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "JURY_VOTE", "FINAL3"] } },
            },
            select: { gameId: true },
          })
        )?.gameId ?? null;
    }
  } catch (e) {
    console.error("HomePage data fetch failed:", e);
  }

  return (
    <main className="pageShell">
      <div className="theme-card-hero">
        <div style={{ padding: "clamp(14px, 3vw, 20px)" }}>
          <div className="homeGrid" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, alignItems: "start" }}>
            <div>
              <div style={{ color: "var(--brand)", fontWeight: 1000, fontSize: "clamp(24px, 5vw, 32px)", letterSpacing: -0.4 }}>
                Regaged
              </div>

              <div className="theme-text-secondary" style={{ marginTop: 8, maxWidth: 560, lineHeight: 1.4, fontSize: 14 }}>
                A reality-game social site — currently in <b>beta</b>. Expect bugs. Help us test.
              </div>

              <div className="homeCtaRow" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/enroll" className="theme-btn-primary">
                  Enroll ▶
                </Link>
                <Link href="/shop" className="theme-btn-secondary">
                  Shop
                </Link>
                {activeGameId && (
                  <Link href={`/game/${activeGameId}`} className="theme-btn-secondary">
                    Resume game
                  </Link>
                )}
              </div>
              <div className="theme-text-muted" style={{ marginTop: 10, fontSize: 12 }}>
                Fastings · Castings · Frookies · Rookies
              </div>
            </div>

            <div className="theme-panel">
              <div className="theme-text-primary" style={{ fontWeight: 1000, textAlign: "center", marginBottom: 10 }}>
                Participate!
              </div>
              <Link href="/enroll" className="theme-btn-primary" style={{ display: "block", textAlign: "center" }}>
                Enroll now ▶
              </Link>

              {me ? (
                <div className="theme-text-secondary" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.45 }}>
                  <div>
                    Logged in as <b className="theme-username">{me.username}</b>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Karma: <b>{me.karma}</b> · R$: <b>{me.tMoney}</b>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link href="/profile" className="theme-link" style={{ fontSize: 13 }}>
                      Profile
                    </Link>
                    {activeGameId && (
                      <Link href={`/game/${activeGameId}`} className="theme-link" style={{ fontSize: 13 }}>
                        Go to game
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="theme-text-secondary" style={{ marginTop: 12, fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
                  New here? <Link href="/register" className="theme-link">Register</Link> or{" "}
                  <Link href="/login" className="theme-link">Login</Link>.
                </div>
              )}
            </div>
          </div>

          <div className="homeShopTiles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
            <Link href="/shop/colors" className="homeShopTile">
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Color Shop</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>Level up</div>
            </Link>
            <Link href="/shop/auctions" className="homeShopTile">
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Auctions</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>Bid on designs</div>
            </Link>
            <Link href="/enroll" className="homeShopTile">
              <div style={{ fontWeight: 1000, fontSize: 12 }}>Enroll</div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>Join a game</div>
            </Link>
          </div>

          <div
            className="home-banner homeBanner"
            style={{
              marginTop: 14,
              borderRadius: 4,
              overflow: "hidden",
              minHeight: 108,
              position: "relative",
            }}
          >
            <div
              className="home-banner-overlay"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.22,
                background: "radial-gradient(circle at 30% 20%, #ffffff, transparent 55%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 14px",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ color: "#fff", fontWeight: 1000, fontSize: "clamp(20px, 6vw, 32px)", letterSpacing: -0.4 }}>
                PLAY NOW
                <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>nominate · veto · alliances</div>
              </div>
              <Link
                href="/enroll"
                className="theme-btn-primary"
                style={{ fontSize: 13, boxShadow: "none" }}
              >
                Pick a mode ▶
              </Link>
            </div>
          </div>
        </div>

        <div className="theme-text-muted" style={{ padding: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
          Regaged · private beta
        </div>
      </div>
    </main>
  );
}
