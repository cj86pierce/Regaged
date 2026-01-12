export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const me = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, karma: true, tMoney: true },
      })
    : null;

  const activeGameId = userId
    ? (
        await prisma.gamePlayer.findFirst({
          where: {
            userId,
            status: "ACTIVE",
            game: { state: { in: ["ROUND_NOMINATE", "ROUND_VOTE", "FINAL3"] } },
          },
          select: { gameId: true },
        })
      )?.gameId ?? null
    : null;

  // Fake/placeholder content for now (we'll wire later)
  const topBlogs = [
    { title: "I WON A FASTING", user: "vaultgirl", hearts: 933, comments: 32 },
    { title: "Thank you 50.7", user: "BURBERRY", hearts: 666, comments: 14 },
    { title: "Im pregnant", user: "cocaina", hearts: 525, comments: 18 },
    { title: "My baby is born", user: "sawCUK5", hearts: 478, comments: 16 },
    { title: "PYN and I'll tell you which store you..", user: "Washed_Ravioli", hearts: 454, comments: 33 },
  ];

  const topGroupGames = [
    {
      tag: "PUBLIC",
      title: "The World's Longest Group Game 2",
      by: "SurvivorFan37",
      desc: "A long-running group game. Low effort group game in the website’s history.",
    },
    {
      tag: "PUBLIC",
      title: "Tengaged Song Contest (Current)",
      by: "ToysIsKajas",
      desc: "Discover new music and showcase your individual music taste.",
    },
    {
      tag: "PUBLIC",
      title: "TG BIG BROTHER #1 · WEEK 9",
      by: "Dimitra",
      desc: "BB-style group game. Placements, stats, and weekly evictions.",
    },
    {
      tag: "PRIVATE",
      title: "The Fallen 🎃",
      by: "Symmetry888",
      desc: "Spooky reunion group game — where nothing will go wrong (probably).",
    },
  ];

  return (
    <main>
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
            <div>
              <div style={{ color: "#d11b1b", fontWeight: 1000, fontSize: 26, letterSpacing: -0.2 }}>
                Big Brother and online Hunger games
              </div>
              <div style={{ marginTop: 6, maxWidth: 520, lineHeight: 1.35, fontSize: 13, color: "#222" }}>
                Tengaged is an online social game: meet new friends while playing Big Brother, Survivor, and other reality
                formats. Form alliances, nominate, vote, and survive the drama.
              </div>
            </div>

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
                    Karma: <b>{me.karma}</b> · T$: <b>{me.tMoney}</b>
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
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
              background: "linear-gradient(90deg, #1a1a1a, #2c2c2c)",
              height: 150,
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", inset: 0, opacity: 0.22, background: "radial-gradient(circle at 30% 20%, #ffffff, transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 18 }}>
              <div style={{ color: "#fff", fontWeight: 1000, fontSize: 34, letterSpacing: -0.4 }}>
                BIG
                <div style={{ lineHeight: 0.9 }}>BROTHER</div>
              </div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 24, opacity: 0.9 }}>
                evictions · nominate · alliances
              </div>
              <div style={{ color: "#7CFF7C", fontWeight: 1000, fontSize: 24, textAlign: "right" }}>
                SURVIVOR
                <div style={{ fontSize: 12, opacity: 0.9 }}>tengaged remake</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { title: "Nominate & Evict", body: "Create alliances, nominate other participants, and avoid eviction." },
              { title: "Multiplayer online game", body: "Participate in reality games and meet new people while playing." },
              { title: "BB UK & BB USA", body: "Progress through formats based on USA or UK rules (later expansion)." },
              { title: "Survivor", body: "Tribes, competitions, tribal councils, and merges." },
              { title: "Online Hunger Games", body: "Participate in hunger-style games and survive." },
              { title: "Make new friends", body: "Real people, real friendships, and real enemies — like classic Tengaged." },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>{c.title}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ color: "#d11b1b", fontWeight: 1000, marginBottom: 10 }}>Top Participants blogs</div>
              <div style={{ display: "grid", gap: 10 }}>
                {topBlogs.map((b) => (
                  <div
                    key={b.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "42px 1fr 90px",
                      gap: 10,
                      alignItems: "center",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.10)",
                        background: "linear-gradient(#f3f6f9, #fff)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        opacity: 0.65,
                      }}
                    >
                      🙂
                    </div>

                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13, color: "#0b5ed7" }}>{b.title}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        by <b>{b.user}</b>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>❤ {b.hearts}</div>
                      <div style={{ opacity: 0.75 }}>💬 {b.comments}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ color: "#d11b1b", fontWeight: 1000, marginBottom: 10 }}>Top Group Games</div>

              <div style={{ display: "grid", gap: 10 }}>
                {topGroupGames.map((g) => (
                  <div
                    key={g.title}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 56,
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "linear-gradient(#f3f6f9, #fff)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          opacity: 0.65,
                        }}
                      >
                        🎮
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 1000,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: g.tag === "PUBLIC" ? "#d1e7dd" : "#f8d7da",
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          >
                            {g.tag}
                          </span>
                          <div style={{ fontWeight: 900, color: "#0b5ed7", fontSize: 13 }}>{g.title}</div>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                          by <b>{g.by}</b>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.35 }}>
                          {g.desc}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                (These are placeholders for now. We’ll hook up real groups/blogs later.)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        Tengaged remake · modern layout inspired by classic Tengaged
      </div>
    </main>
  );
}
