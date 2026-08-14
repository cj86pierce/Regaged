"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Avatar, { AvatarConfig, type SlotDesignType } from "@/components/Avatar";
import StatusBadges from "@/components/StatusBadges";
import { formatLastSeen } from "@/lib/lastSeenLabel";
import { renderBioContent } from "@/lib/renderBio";
import { colorLevelSwatch, colorLevelSwatchClass, isTvStarColor } from "@/lib/colorLevelCss";
import ProfileSocialActions from "@/components/ProfileSocialActions";
import "@/styles/tengagedProfile.css";

export type ProfileGameBubble = {
  gameId: string;
  gameNumber: number;
  gameType: string;
  state: string;
  joinedAt: string;
  yourStatus: "ACTIVE" | "ELIMINATED";
  eliminatedPlace: number | null;
};

export type ProfileTabsData = {
  isOwnProfile: boolean;
  username: string;
  joinedAt: string;
  karma: number;
  /** 1-based karma Hall of Fame rank; badge shown if ≤ 500 */
  hofRank?: number | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  isWarned?: boolean;
  isBanned?: boolean;
  /** Own profile: show verify email CTA when unset */
  emailVerified?: boolean;
  tMoney: number;
  colorName: string;
  colorAnimated: boolean;
  lastSeenAt: string;
  bio: string;

  avatar: AvatarConfig;
  slotDesigns?: Partial<Record<SlotDesignType, string>>;

  stats: {
    gamesPlayed: number;
    totalChats: number;
    totalPlus: number;
    totalMinus: number;
    totalPov: number;
  };

  recentGames: ProfileGameBubble[];
  recentGamesPage: number;
  recentGamesTotalPages: number;

  blogPosts: { id: string; title: string; createdAt?: string }[];

  friends: { id: string; username: string; avatar: AvatarConfig; slotDesigns?: Partial<Record<SlotDesignType, string>>; isMutual: boolean }[];
  isFriend?: boolean;
  canAddFriend?: boolean;
  /** Logged-in viewer looking at someone else's profile — shows heart/mail */
  showSocialActions?: boolean;
  profileUserId?: string;

  colorHistory?: { name: string; purchasedAt: string }[];
  bets?: {
    id: string;
    gameId: string;
    gameNumber: number;
    amount: number;
    payoutAmount: number | null;
    paidOutAt: string | null;
    createdAt: string;
    targetUsername: string;
  }[];
  /** Designs this player listed that went to auction */
  myAuctions?: {
    id: string;
    auctionId: string;
    designId: string;
    designTitle: string;
    soldPrice: number;
    soldAt: string | null;
    endsAt: string;
  }[];
  /** Designs this player owns (auction wins + staff gifts) */
  designGifts?: {
    id: string;
    title: string;
    designType: string;
    acquiredAt: string;
  }[];
  latestActions?: { id: string; label: string; href?: string; at: string; ago: string }[];
};

function ReorderFriendsButton({
  friends,
  onReordered,
}: {
  friends: { id: string; username: string }[];
  onReordered: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>(() => friends.map((f) => f.id));
  const [saving, setSaving] = useState(false);

  function moveUp(i: number) {
    if (i <= 0) return;
    const next = [...order];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setOrder(next);
  }
  function moveDown(i: number) {
    if (i >= order.length - 1) return;
    const next = [...order];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setOrder(next);
  }
  async function save() {
    setSaving(true);
    const res = await fetch("/api/friends/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ friendIds: order }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      onReordered();
    }
  }
  if (!editing) {
    return (
      <button
        onClick={() => {
          setEditing(true);
          setOrder(friends.map((f) => f.id));
        }}
        style={{
          marginTop: 8,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.12)",
                        background: "var(--bg-btn-disabled)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Reorder
      </button>
    );
  }
  return (
    <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
      {order.map((id, i) => {
        const f = friends.find((x) => x.id === id);
        if (!f) return null;
        return (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--reorder-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              onClick={() => moveUp(i)}
              disabled={i === 0}
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: i === 0 ? "var(--reorder-alt)" : "var(--reorder-bg)",
                cursor: i === 0 ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(i)}
              disabled={i === order.length - 1}
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: i === order.length - 1 ? "var(--reorder-alt)" : "var(--reorder-bg)",
                cursor: i === order.length - 1 ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              ↓
            </button>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{f.username}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            background: saving ? "var(--bg-btn-disabled)" : "var(--save-btn-bg)",
            color: "var(--text-btn-send)",
            fontWeight: 800,
            fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--reorder-bg)",
            color: "var(--text-primary)",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function suffix(n: number) {
  const j = n % 10,
    k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function gameBtnClass(gameType: string): string {
  const t = gameType.toUpperCase();
  if (t.includes("SURVIVOR")) return "sv";
  if (t.includes("HUNGER")) return "hg";
  if (t.includes("STAR")) return "st";
  if (t.includes("CHALLENGE") || t.includes("DUEL")) return "ch";
  if (t.includes("FROOK") || t.includes("ROOK")) return "rk";
  return "bb"; // casting / fasting / default
}

function GameChip({ g }: { g: ProfileGameBubble }) {
  const isActiveGame = g.state !== "COMPLETED" && g.yourStatus === "ACTIVE";
  const isFilling = g.state === "ENROLLING" && g.yourStatus === "ACTIVE";
  const placeLabel =
    !isActiveGame && g.eliminatedPlace != null ? suffix(g.eliminatedPlace) : null;
  const dateLabel = new Date(g.joinedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
  const typeLetter = g.gameType.replace(/_BOT$/i, "").charAt(0).toUpperCase();
  const bubble = gameBtnClass(g.gameType);
  const placeDigits = placeLabel ? String(g.eliminatedPlace).length : 0;

  return (
    <Link href={`/game/${g.gameId}`} className="tgGame">
      <span
        className={`tgGameBtn ${bubble}${isActiveGame ? " enter" : ""}${
          placeDigits >= 2 ? " wide" : ""
        }`}
      >
        {isActiveGame ? "Enter" : placeLabel ?? "—"}
      </span>
      <div className="tgGameStatus">
        <span className="tgFastSign">{typeLetter}</span>
        {isActiveGame ? (isFilling ? "Filling" : "Enter") : "Finished"}
        <br />#{g.gameNumber}
        <br />
        {dateLabel}
      </div>
    </Link>
  );
}

export default function ProfileTabs({ data }: { data: ProfileTabsData }) {
  const joinedLabel = useMemo(() => new Date(data.joinedAt).toLocaleDateString(), [data.joinedAt]);
  const last = useMemo(() => formatLastSeen(data.lastSeenAt), [data.lastSeenAt]);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(data.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("tgProfilePage");
    return () => document.body.classList.remove("tgProfilePage");
  }, []);

  async function saveBio() {
    setBioSaving(true);
    setBioMsg(null);
    const res = await fetch("/api/profile/bio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bio: bioDraft }),
    });
    const json = await res.json().catch(() => ({}));
    setBioSaving(false);
    if (!res.ok) return setBioMsg(json?.error ?? "Save failed");
    setBioMsg("Saved!");
    setEditingBio(false);
  }

  const pageBase = data.isOwnProfile ? "/profile" : `/u/${data.username.toLowerCase()}`;
  const openBet = (data.bets ?? []).find((b) => !b.paidOutAt);

  return (
    <main className="profilePage tgProfile">
      <div className="tgLayout">
        <div className="tgColLeft">
          <div className="tgUserHeader">
            <div className="tgAvatar">
              {data.isOwnProfile ? (
                <Link href="/profile/avatar" title="Edit avatar" style={{ display: "inline-block" }}>
                  <Avatar config={data.avatar} width={140} slotDesigns={data.slotDesigns} />
                </Link>
              ) : (
                <Avatar config={data.avatar} width={140} slotDesigns={data.slotDesigns} />
              )}
            </div>

            <div className="tgUserInfo">
              <h1 className="tgName">
                <span className="tgNameText">{data.username}</span>
                <StatusBadges
                  isOwner={data.isOwner}
                  isAdmin={data.isAdmin}
                  isWarned={data.isWarned}
                  isBanned={data.isBanned}
                  hofRank={null}
                  size="sm"
                />
              </h1>

              <div className="tgStatRow">
                <div>
                  Karma: <span className="tgRemark">{data.karma}</span>
                  {data.hofRank != null && data.hofRank > 0 && data.hofRank <= 500 ? (
                    <span className="tgMiniRank">
                      {data.hofRank}
                      <span style={{ fontSize: 9 }}>{suffix(data.hofRank).replace(String(data.hofRank), "")}</span>
                    </span>
                  ) : null}
                </div>
                {data.isOwnProfile ? (
                  <div>
                    Money: <span className="tgRemark">{data.tMoney}</span> R$
                  </div>
                ) : null}
                <div>
                  Played: <span className="tgRemark">{data.stats.gamesPlayed}</span> times
                </div>
                <div>
                  Last Activity: <span className="tgRemark">{last}</span>
                </div>
                <div>
                  Joined: <span className="tgRemark">{joinedLabel}</span>
                </div>
              </div>

              {data.profileUserId ? (
                <ProfileSocialActions
                  profileUserId={data.profileUserId}
                  username={data.username}
                  isOwnProfile={data.isOwnProfile}
                  initialIsFriend={data.isFriend}
                  initialCanAddFriend={data.canAddFriend}
                  designGifts={data.designGifts}
                />
              ) : null}

              {data.isOwnProfile && data.isWarned ? (
                <div className="tgAdvise" style={{ marginTop: 10 }}>
                  Your account is warned. You cannot enroll in games until an owner clears the warning.
                </div>
              ) : null}
            </div>

            <div className="tgGradeCol">
              <span
                className={`lvlSwatch tgGradeBelt ${colorLevelSwatchClass(
                  data.colorName,
                  data.colorAnimated || isTvStarColor(data.colorName)
                )}`}
                style={{ ["--lvl" as string]: colorLevelSwatch(data.colorName) }}
                title={data.colorName}
                aria-label={`Color level: ${data.colorName}`}
              />
            </div>
          </div>

          <div className="tgSpeech">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              {data.isOwnProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setBioDraft(data.bio ?? "");
                    setBioMsg(null);
                    setEditingBio((v) => !v);
                  }}
                  style={{
                    border: "1px solid #ccc",
                    background: "#fff",
                    borderRadius: 3,
                    padding: "1px 7px",
                    fontSize: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {editingBio ? "Cancel" : "Edit"}
                </button>
              )}
            </div>

            {editingBio && data.isOwnProfile ? (
              <div style={{ display: "grid", gap: 8 }}>
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    background: "#fff",
                    color: "#252525",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: 11,
                  }}
                  placeholder="Write your bio…"
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={saveBio}
                    disabled={bioSaving}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 3,
                      border: "1px solid #999",
                      background: bioSaving ? "#ddd" : "#257eb2",
                      color: bioSaving ? "#555" : "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: bioSaving ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {bioSaving ? "Saving..." : "Save"}
                  </button>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{bioDraft.length}/1000</span>
                  {bioMsg && <span style={{ fontSize: 11, fontWeight: 700 }}>{bioMsg}</span>}
                </div>
              </div>
            ) : data.bio?.trim().length ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{renderBioContent(data.bio)}</div>
            ) : (
              <span style={{ opacity: 0.55 }}>No bio yet.</span>
            )}
          </div>

          <div className="tgSection">
            <div className="tgSectionTitle">
              <h2>My Games</h2>
              <span className="tgSectionMeta">{data.stats.gamesPlayed} games played</span>
            </div>
            {data.recentGamesTotalPages > 1 ? (
              <div className="tgPager">
                {Array.from({ length: Math.min(data.recentGamesTotalPages, 8) }, (_, i) => i + 1).map((p) => (
                  <Link key={p} href={`${pageBase}?page=${p}`} className={p === data.recentGamesPage ? "on" : undefined}>
                    {p}
                  </Link>
                ))}
                {data.recentGamesTotalPages > 8 ? (
                  <>
                    <span>…</span>
                    <Link href={`${pageBase}?page=${data.recentGamesTotalPages}`}>{data.recentGamesTotalPages}</Link>
                  </>
                ) : null}
              </div>
            ) : null}
            {data.recentGames.length === 0 ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No games yet.</div>
            ) : (
              <div className="tgGames">
                {data.recentGames.map((g) => (
                  <GameChip key={g.gameId} g={g} />
                ))}
              </div>
            )}
          </div>

          <div className="tgSection">
            <div className="tgSectionTitle">
              <h2>My Blog</h2>
              <Link href="/blogs" className="tgAction">
                Check my blog!
              </Link>
            </div>
            {data.blogPosts.length === 0 ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No blog posts yet.</div>
            ) : (
              <ol className="tgBlogList">
                {data.blogPosts.map((b) => (
                  <li key={b.id}>
                    <Link href={`/blogs/${b.id}`}>{b.title}</Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="tgColRight">
          {data.isOwnProfile ? (
            <div className="tgSideBlock">
              <div className="tgSideTitle">Profile</div>
              <div style={{ display: "grid", gap: 8 }}>
                <Link
                  href="/enroll"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "8px 10px",
                    background: "#f5d76e",
                    border: "1px solid #d4b84a",
                    color: "#333",
                    fontWeight: 700,
                    textDecoration: "none",
                    fontSize: 12,
                  }}
                >
                  Enroll now ▶
                </Link>
                {!data.emailVerified && (
                  <Link
                    href="/profile/edit#email"
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "8px 10px",
                      background: "#b91c1c",
                      color: "#fff",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: 12,
                    }}
                  >
                    Verify email
                  </Link>
                )}
                <Link href="/profile/edit" className="tgAction" style={{ textAlign: "center", display: "block" }}>
                  Edit Profile
                </Link>
              </div>
            </div>
          ) : null}

          <div className="tgSideBlock">
            <div className="tgSideTitle">Friends</div>
            {data.friends.length > 0 ? (
              <div>
                <div className="tgFriends">
                  {data.friends.map((f) => (
                    <Link
                      key={f.id}
                      href={`/u/${f.username.toLowerCase()}`}
                      title={f.username + (f.isMutual ? " (mutual)" : "")}
                      className="tgFriend"
                    >
                      <Avatar config={f.avatar} width={48} slotDesigns={f.slotDesigns} />
                      <div style={{ marginTop: 3 }}>{f.username}</div>
                    </Link>
                  ))}
                </div>
                {data.isOwnProfile && data.friends.length > 1 && (
                  <ReorderFriendsButton friends={data.friends} onReordered={() => window.location.reload()} />
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No friends yet</div>
            )}
          </div>

          <div className="tgSideBlock">
            <div className="tgSideTitle">My Bets</div>
            {openBet ? (
              <div className="tgAdvise">
                <Link href={`/game/${openBet.gameId}`} style={{ float: "right", fontWeight: 700 }}>
                  #{openBet.gameNumber}
                </Link>
                Open now:&nbsp;
              </div>
            ) : null}
            {(data.bets?.length ?? 0) === 0 ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No bets yet.</div>
            ) : (
              <table className="tgBetsTable">
                <tbody>
                  {(data.bets ?? []).slice(0, 10).map((b) => {
                    const won = !!b.paidOutAt && (b.payoutAmount ?? 0) > 0;
                    return (
                      <tr key={b.id}>
                        <td>
                          <span className="tgRemark">{b.amount}</span> to{" "}
                          <Link href={`/u/${b.targetUsername.toLowerCase()}`}>{b.targetUsername}</Link>
                        </td>
                        <td>
                          in <Link href={`/game/${b.gameId}`}>#{b.gameNumber}</Link>
                        </td>
                        <td style={{ textAlign: "right", color: won ? "#2e7d32" : "#888", fontWeight: won ? 700 : 500 }}>
                          {won ? (
                            <>
                              won: <span className="tgRemark">{b.payoutAmount}</span>
                            </>
                          ) : (
                            "open"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="tgSideBlock">
            <div className="tgSideTitle">My auctions</div>
            {(data.myAuctions?.length ?? 0) === 0 ? (
              <div style={{ fontSize: 11, opacity: 0.7 }}>No auctions yet.</div>
            ) : (
              <table className="tgBetsTable">
                <tbody>
                  {(data.myAuctions ?? []).slice(0, 10).map((a) => {
                    const sold = !!a.soldAt;
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/designs/${a.designId}`}>{a.designTitle}</Link>
                        </td>
                        <td>
                          <Link href="/shop/auctions">auction</Link>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: sold ? "#2e7d32" : "#888",
                            fontWeight: sold ? 700 : 500,
                          }}
                        >
                          {sold ? (
                            <>
                              sold: <span className="tgRemark">{a.soldPrice}</span>
                            </>
                          ) : (
                            <>
                              open: <span className="tgRemark">{a.soldPrice}</span>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!data.isOwnProfile && (
            <div className="tgReportRow">
              <span>Report this User</span>
              <Link href={`/contact?report=${encodeURIComponent(data.username)}`} className="tgReportBtn">
                REPORT
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
