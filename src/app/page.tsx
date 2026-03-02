export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const userId = await getCurrentUserIdFromHeaders();

  const me = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, karma: true, tMoney: true, pMoney: true },
      })
    : null;

  const activeGameId = userId
    ? (
        await prisma.gamePlayer.findFirst({
          where: {
            userId,
            status: "ACTIVE",
            game: { state: { in: ["ENROLLING", "ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
          },
          select: { gameId: true },
        })
      )?.gameId ?? null
    : null;

  return (
    <main style={{ padding: 12 }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, alignItems: "start" }}>
            {/* Left hero */}
            <div>
              <div style={{ color: "#d11b1b", fontWeight: 1000, fontSize: 28, letterSpacing: -0.3 }}>
                Regaged
              </div>

              <div style={{ marginTop: 6, maxWidth: 560, lineHeight: 1.35, fontSize: 13, color: "#222" }}>
                A reality-game social site — currently in <b>beta</b>. Expect bugs. More games soon.
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/enroll"
                  style={{
                    textDecoration: "none",
                    fontWeight: 1000,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "linear-gradient(#ffd85a, #ffb703)",
                    color: "#3a2b00",
                    border: "1px solid rgba(0,0,0,0.12)",
                    boxShadow: "0 8px 18px rgba(255, 183, 3, 0.25)",
                    display: "inline-block",
                  }}
                >
                  Enroll ▶
                </Link>

                <Link
                  href="/shop"
                  style={{
                    textDecoration: "none",
                    fontWeight: 1000,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "linear-gradient(#eaf2ff, #d6e6ff)",
                    color: "#0b2b66",
                    border: "1px solid rgba(0,0,0,0.12)",
                    display: "inline-block",
                  }}
                >
                  Shop
                </Link>

                <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
                  ✅ Fastings playable · 🧪 More modes later
                </div>
              </div>
            </div>

            {/* Right participate */}
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 12,
                padding: 12,
                background: "linear-gradient(#fff, #f7f9fb)",
              }}
            >
              <div style={{ fontWeight: 1000, textAlign: "center", marginBottom: 10 }}>Participate!</div>

              <Link
                href="/enroll"
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 1000,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "linear-gradient(#ffd85a, #ffb703)",
                  color: "#3a2b00",
                  border: "1px solid rgba(0,0,0,0.12)",
                  boxShadow: "0 8px 18px rgba(255, 183, 3, 0.25)",
                }}
              >
                Enroll now ▶
              </Link>

              {me ? (
                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.4 }}>
                  <div>
                    Logged in as <b>{me.username}</b>
                  </div>
                  <div>
                    Karma: <b>{me.karma}</b> · R$: <b>{me.tMoney}</b>
                  <div>
                    P$: <b>{me.pMoney}</b> <span style={{ fontSize: 10, opacity: 0.7 }}>(Premium)</span>
                  </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href="/profile" style={{ fontWeight: 900, fontSize: 12, color: "#0b5ed7" }}>
                      Profile
                    </Link>
                    {activeGameId && (
                      <Link href={`/game/${activeGameId}`} style={{ fontWeight: 900, fontSize: 12, color: "#0b5ed7" }}>
                        Go to game
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                  New here?{" "}
                  <Link href="/register" style={{ fontWeight: 900, color: "#0b5ed7" }}>
                    Register
                  </Link>{" "}
                  or{" "}
                  <Link href="/login" style={{ fontWeight: 900, color: "#0b5ed7" }}>
                    Login
                  </Link>
                  .
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                More games soon. Fastings is the main mode for now.
              </div>
            </div>
          </div>

          {/* Simple banner */}
          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
              background: "linear-gradient(90deg, #1a1a1a, #2c2c2c)",
              height: 130,
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", inset: 0, opacity: 0.22, background: "radial-gradient(circle at 30% 20%, #ffffff, transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18 }}>
              <div style={{ color: "#fff", fontWeight: 1000, fontSize: 32, letterSpacing: -0.4 }}>
                FASTINGS
                <div style={{ fontSize: 12, opacity: 0.85 }}>nominate · evict · alliances</div>
              </div>

              <div style={{ color: "#ffeb3b", fontWeight: 1000, fontSize: 18, textAlign: "right" }}>
                Beta build
                <div style={{ fontSize: 12, opacity: 0.9 }}>bugs expected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer inside card */}
        <div style={{ padding: 14, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 12, opacity: 0.75 }}>
          Regaged · private beta
        </div>
      </div>
    </main>
  );
}
