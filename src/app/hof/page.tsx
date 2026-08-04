import Link from "next/link";
import Avatar from "@/components/Avatar";
import HofBadge, { formatHofRank, hofBadgeStyle } from "@/components/HofBadge";
import { avatarConfigFromUser } from "@/lib/avatarConfigFromUser";
import { getSlotDesignsForUserIds } from "@/lib/avatarSlotDesigns";
import { getHofTop, HOF_AVATAR_TOP, HOF_DISPLAY_TOP, HOF_SIZE } from "@/lib/hof";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HofPage() {
  const entries = await getHofTop(HOF_DISPLAY_TOP);
  const topAvatars = entries.slice(0, HOF_AVATAR_TOP);

  const avatarUsers =
    topAvatars.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: topAvatars.map((e) => e.userId) } },
          select: {
            id: true,
            bodyStyle: true,
            hairStyle: true,
            eyesStyle: true,
            mouthStyle: true,
            shirtStyle: true,
            accessoryStyle: true,
            glassesStyle: true,
            scarStyle: true,
            hairOrnamentStyle: true,
            bodyColor: true,
            hairColor: true,
            eyeColor: true,
            mouthColor: true,
            shirtColor: true,
            accessoryColor: true,
            backgroundColor: true,
            glassesColor: true,
            scarColor: true,
            hairOrnamentColor: true,
          },
        });

  const avatarById = new Map(avatarUsers.map((u) => [u.id, u]));
  const slotByUser = await getSlotDesignsForUserIds(topAvatars.map((e) => e.userId));

  return (
    <main className="pageShell" style={{ maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Hall of Fame</h1>
      <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.45, marginBottom: 18 }}>
        Top players by <b>Karma</b>. Avatars for the top {HOF_AVATAR_TOP}; names through top{" "}
        {HOF_DISPLAY_TOP}. Profile badges go to the top {HOF_SIZE}.
      </p>

      {entries.length === 0 ? (
        <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 16, fontSize: 13, opacity: 0.7 }}>
          No players yet.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
              gap: 12,
              marginBottom: 22,
            }}
          >
            {topAvatars.map((e) => {
              const u = avatarById.get(e.userId);
              const style = hofBadgeStyle(e.rank);
              return (
                <Link
                  key={e.userId}
                  href={`/u/${encodeURIComponent(e.username.toLowerCase())}`}
                  className="theme-sidebar-panel"
                  style={{
                    display: "grid",
                    justifyItems: "center",
                    gap: 8,
                    padding: "14px 10px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "inherit",
                    border:
                      e.rank <= 3
                        ? `1px solid ${e.rank === 1 ? "#d4a017" : e.rank === 2 ? "#9e9e9e" : "#8b5a2b"}`
                        : undefined,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      ...style,
                    }}
                  >
                    {formatHofRank(e.rank)}
                  </span>
                  {u ? (
                    <Avatar
                      config={avatarConfigFromUser(u)}
                      width={e.rank <= 3 ? 110 : 96}
                      slotDesigns={slotByUser[e.userId]}
                    />
                  ) : (
                    <div style={{ width: 96, height: 96, borderRadius: 8, background: "var(--bg-msg)" }} />
                  )}
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <div
                      style={{
                        fontWeight: e.rank <= 3 ? 1000 : 900,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.username}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                      {e.karma.toLocaleString()} karma
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr 100px",
                gap: 8,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 900,
                opacity: 0.7,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>Rank</span>
              <span>Player</span>
              <span style={{ textAlign: "right" }}>Karma</span>
            </div>

            {entries.map((e) => {
              const style = hofBadgeStyle(e.rank);
              return (
                <Link
                  key={e.userId}
                  href={`/u/${encodeURIComponent(e.username.toLowerCase())}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr 100px",
                    gap: 8,
                    padding: "9px 14px",
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                    borderBottom: "1px solid var(--border)",
                    background:
                      e.rank <= 3 ? "color-mix(in srgb, var(--accent-bg) 35%, transparent)" : undefined,
                  }}
                >
                  <span>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        ...style,
                      }}
                    >
                      {formatHofRank(e.rank)}
                    </span>
                  </span>
                  <span
                    style={{
                      fontWeight: e.rank <= 3 ? 1000 : 800,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {e.username}
                    <HofBadge rank={e.rank} />
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {e.karma.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
