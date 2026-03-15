"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Avatar, { AvatarConfig, type SlotDesignType } from "@/components/Avatar";
import { formatLastSeen } from "@/lib/lastSeenLabel";

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
  tMoney: number;
  pMoney: number;
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

  blogPosts: { id: string; title: string }[];

  friends: { id: string; username: string; avatar: AvatarConfig; slotDesigns?: Partial<Record<SlotDesignType, string>>; isMutual: boolean }[];
  isFriend?: boolean;
  canAddFriend?: boolean;
  profileUserId?: string;
};

function AddFriendButton({
  username,
  profileUserId,
  onAdded,
}: {
  username: string;
  profileUserId: string;
  onAdded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/friends/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(json?.error ?? "Failed");
    onAdded();
  }
  return (
    <div>
      <button
        onClick={add}
        disabled={loading}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: loading ? "var(--loading-bg)" : "var(--add-friend-loading)",
          color: "var(--add-friend-loading-text)",
          fontWeight: 800,
          fontSize: 13,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Adding..." : "Add friend"}
      </button>
      {error && <div style={{ fontSize: 12, color: "var(--text-error)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

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

function RemoveFriendButton({ friendId, onRemoved }: { friendId: string; onRemoved: () => void }) {
  const [loading, setLoading] = useState(false);
  async function remove() {
    setLoading(true);
    const res = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    setLoading(false);
    if (res.ok) onRemoved();
  }
  return (
    <button
      onClick={remove}
      disabled={loading}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: loading ? "var(--loading-bg)" : "var(--remove-friend-loading)",
        color: "var(--remove-friend-loading-text)",
        fontWeight: 800,
        fontSize: 13,
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Removing..." : "Remove friend"}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="theme-card" style={{ borderRadius: 14, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontWeight: 1000 }}>{title}</div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function suffix(n: number) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

const COLOR_SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#ffeb3b",
  orange: "#ff9800",
  "light green": "#8bc34a",
  green: "#2e7d32",
  blue: "#1e88e5",
  purple: "#8e24aa",
  red: "#e53935",
  brown: "#6d4c41",
  black: "#111111",
  silver: "#c0c0c0",
  gold: "#ffd700",
  sky: "#4fc3f7",
  blood: "#8b0000",
  "tv star": "#ff66cc",
};

function colorToSwatch(name: string) {
  const key = name.trim().toLowerCase();
  return COLOR_SWATCH[key] ?? "#ffffff";
}

function StatLine({ label, value, suffixText, isCurrency }: { label: string; value: React.ReactNode; suffixText?: string; isCurrency?: boolean }) {
  return (
    <div className="profileStatLine" style={{ display: "grid", gridTemplateColumns: "80px auto 1fr", alignItems: "center", gap: 10, marginTop: 8 }}>
      <div style={{ fontSize: 22, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ padding: "6px 10px", background: isCurrency ? "var(--bg-currency)" : "var(--bg-btn-disabled)", borderRadius: 4, fontSize: 26, fontWeight: 1000, lineHeight: 1, color: "var(--text-primary)" }}>
        {value}
      </div>
      {suffixText ? <div style={{ fontSize: 22, color: "var(--text-muted)" }}>{suffixText}</div> : <div />}
    </div>
  );
}

function gameBubbleColor(gameType: string): string {
  const t = gameType.toUpperCase();
  if (t === "SURVIVOR") return "var(--game-bubble-survivor)";
  if (t === "FROOKIES" || t === "ROOKIES") return "var(--game-bubble-frookies)";
  return "var(--game-bubble-fasting)";
}

function Bubble({ g }: { g: ProfileGameBubble }) {
  const isActiveGame = g.state !== "COMPLETED" && g.yourStatus === "ACTIVE";
  const isFilling = g.state === "ENROLLING" && g.yourStatus === "ACTIVE";

  const labelTop = g.gameType.toLowerCase().replace(/_/g, " ");
  const labelBottom = isActiveGame ? (isFilling ? "Filling" : "Enter") : g.eliminatedPlace ? suffix(g.eliminatedPlace) : "—";
  const bubbleBg = gameBubbleColor(g.gameType);

  return (
    <div className="profileGameBubble" style={{ textAlign: "center", width: 92, flexShrink: 0 }}>
      <Link href={`/game/${g.gameId}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            border: "2px solid var(--border)",
            background: bubbleBg,
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            fontWeight: 1000,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.95, textTransform: "uppercase" }}>{labelTop}</div>
          <div
            style={{
              position: "absolute",
              bottom: -9,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 1000,
              border: "1px solid var(--border)",
              background: isActiveGame ? "var(--bg-btn-send)" : "var(--bg-card)",
              color: isActiveGame ? "var(--text-btn-send)" : "var(--text-primary)",
              minWidth: 56,
              textAlign: "center",
            }}
          >
            {labelBottom}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function ProfileTabs({ data }: { data: ProfileTabsData }) {
  const joinedLabel = useMemo(() => new Date(data.joinedAt).toLocaleDateString(), [data.joinedAt]);
  const last = useMemo(() => formatLastSeen(data.lastSeenAt), [data.lastSeenAt]);
  const swatch = colorToSwatch(data.colorName);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(data.bio ?? "");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);

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

  const isTvStar = data.colorName.trim().toLowerCase() === "tv star";
  const swatchClass = `lvlSwatch ${isTvStar ? "tvstar" : ""} ${(data.colorAnimated || isTvStar) ? "animated" : "static"}`;

  return (
    <main style={{ padding: 8 }} className="profilePage">
      <div className="profileLayout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        <Card title="Profile">
          <div className="profileCardInner" style={{ display: "grid", gridTemplateColumns: "220px 1fr 110px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", placeItems: "start" }}>
              <Avatar config={data.avatar} width={190} slotDesigns={data.slotDesigns} />
            </div>

            <div>
              {/* ✅ Wrap name + bar so bar spans under swatch too */}
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div className="profileUsername theme-username" style={{ fontSize: 38, lineHeight: 1 }}>
                    {data.username}
                  </div>

                  {/* bar is in the right column, but the background bar spans full width */}
                  <div style={{ width: 0 }} />
                </div>

                {/* ✅ full-width bar behind */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 40,
                    height: 10,
                    borderRadius: 999,
                        background: "var(--bg-btn-disabled)",
                        border: "1px solid var(--border)",
                    zIndex: -1,
                  }}
                />
              </div>

              <StatLine label="Karma:" value={data.karma} isCurrency />
              {data.isOwnProfile && (
                <>
                  <StatLine label="Money:" value={data.tMoney} suffixText="R$" isCurrency />
                  <StatLine label="Premium" value={data.pMoney} suffixText="P$" isCurrency />
                </>
              )}
              <StatLine label="Played:" value={data.stats.gamesPlayed} suffixText="times" />

              <div style={{ marginTop: 8, fontSize: 14, color: "var(--muted-gray)" }}>
                Last Activity: <b>{last}</b>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-gray-2)" }}>Joined {joinedLabel}</div>
            </div>

            {/* ✅ Swatch sits here; bar spans under it because the bar uses full width (left/right) */}
            <div style={{ display: "grid", justifyItems: "end", paddingTop: 6 }}>
              <div
                title={data.colorName}
                className={swatchClass}
                style={{ ["--lvl" as any]: swatch }}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="theme-chat-msg-sys" style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 10, padding: 12, minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 1000 }}>Bio</div>
              {data.isOwnProfile && (
                <button
                  onClick={() => {
                    setBioDraft(data.bio ?? "");
                    setBioMsg(null);
                    setEditingBio((v) => !v);
                  }}
                  className="theme-pager-btn"
                  style={{ padding: "6px 10px", borderRadius: 10, fontWeight: 1000, cursor: "pointer" }}
                >
                  {editingBio ? "Cancel" : "Edit"}
                </button>
              )}
            </div>

            {editingBio && data.isOwnProfile ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={6}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Write your bio…"
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={saveBio}
                    disabled={bioSaving}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: bioSaving ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
                      color: bioSaving ? "var(--text-primary)" : "var(--text-btn-send)",
                      fontWeight: 1000,
                      cursor: bioSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {bioSaving ? "Saving..." : "Save"}
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{bioDraft.length}/1000</div>
                  {bioMsg && <div style={{ fontSize: 12, fontWeight: 1000 }}>{bioMsg}</div>}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.35 }}>
                {data.bio?.trim().length ? data.bio : <span style={{ opacity: 0.6 }}>No bio yet.</span>}
              </div>
            )}
          </div>

          {/* My Games */}
          <div style={{ marginTop: 14 }}>
            <Card title="My Games">
              <div className="profileGameBubbles" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                {data.recentGames.map((g) => (
                  <Bubble key={g.gameId} g={g} />
                ))}
              </div>
              {data.recentGamesTotalPages > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {data.recentGamesPage > 1 ? (
                    <Link
                      href={data.isOwnProfile ? `/profile?page=${data.recentGamesPage - 1}` : `/u/${data.username.toLowerCase()}?page=${data.recentGamesPage - 1}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "var(--bg-card)",
                        textDecoration: "none",
                        color: "var(--text-primary)",
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      ← Prev
                    </Link>
                  ) : (
                    <span className="theme-text-muted" style={{ padding: "6px 10px", borderRadius: 8, background: "var(--bg-btn-disabled)", fontSize: 12 }}>← Prev</span>
                  )}
                  <span style={{ fontSize: 13 }}>
                    Page {data.recentGamesPage} of {data.recentGamesTotalPages}
                  </span>
                  {data.recentGamesPage < data.recentGamesTotalPages ? (
                    <Link
                      href={data.isOwnProfile ? `/profile?page=${data.recentGamesPage + 1}` : `/u/${data.username.toLowerCase()}?page=${data.recentGamesPage + 1}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "var(--bg-card)",
                        textDecoration: "none",
                        color: "var(--text-primary)",
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      Next →
                    </Link>
                  ) : (
                    <span className="theme-text-muted" style={{ padding: "6px 10px", borderRadius: 8, background: "var(--bg-btn-disabled)", fontSize: 12 }}>Next →</span>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Blogs written */}
          {data.blogPosts.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Card title="Blogs">
                <div style={{ display: "grid", gap: 6 }}>
                  {data.blogPosts.map((b) => (
                    <Link
                      key={b.id}
                      href={`/blogs/${b.id}`}
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--link-color)",
                        textDecoration: "none",
                      }}
                    >
                      {b.title}
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </Card>

        {/* RIGHT */}
        <div className="profileSidebar" style={{ display: "grid", gap: 14 }}>
          <Card title="Participate!">
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/enroll" className="theme-btn-primary" style={{ display: "block", textAlign: "center" }}>
                Enroll now ▶
              </Link>

              {data.isOwnProfile && (
  <Link href="/profile/edit" className="theme-btn-secondary" style={{ display: "block", textAlign: "center" }}>
    Edit Profile
  </Link>
)}


              {data.isOwnProfile && (
                <Link href="/profile/avatar" className="theme-btn-secondary" style={{ display: "block", textAlign: "center" }}>
                  Customize Avatar
                </Link>
              )}
            </div>
          </Card>

          {/* Friends */}
          <Card title="Friends">
              {data.friends.length > 0 && (
                <div style={{ marginBottom: (data.canAddFriend || data.isFriend) ? 10 : 0 }}>
                  <div className="profileFriendsList" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {data.friends.map((f) => (
                      <Link
                        key={f.id}
                        href={`/u/${f.username.toLowerCase()}`}
                        title={f.username + (f.isMutual ? " (mutual)" : "")}
                        className="profileFriendLink"
                        style={{
                          display: "block",
                          textDecoration: "none",
                          color: "inherit",
                          textAlign: "center",
                          padding: 6,
                          borderRadius: 10,
                          background: f.isMutual ? "var(--friend-mutual-bg)" : "transparent",
                          border: f.isMutual ? "1px solid var(--friend-mutual-border)" : "1px solid transparent",
                        }}
                      >
                        <Avatar config={f.avatar} width={48} slotDesigns={f.slotDesigns} />
                        <div className="theme-username" style={{ fontSize: 11, marginTop: 4, wordBreak: "break-word" }}>{f.username}</div>
                      </Link>
                    ))}
                  </div>
                  {data.isOwnProfile && data.friends.length > 1 && (
                    <ReorderFriendsButton friends={data.friends} onReordered={() => window.location.reload()} />
                  )}
                </div>
              )}
              {!data.isOwnProfile && data.profileUserId && (
                <Link
                  href={`/dms/${data.profileUserId}`}
                  className="theme-btn-secondary"
                  style={{ display: "block", textAlign: "center", marginBottom: 10 }}
                >
                  ✉️ Message
                </Link>
              )}
              {data.canAddFriend && data.profileUserId && (
                <AddFriendButton
                  username={data.username}
                  profileUserId={data.profileUserId}
                  onAdded={() => window.location.reload()}
                />
              )}
              {data.isFriend && data.profileUserId && (
                <RemoveFriendButton friendId={data.profileUserId} onRemoved={() => window.location.reload()} />
              )}
              {data.friends.length === 0 && !data.canAddFriend && !data.isFriend && (
                <div style={{ fontSize: 13, color: "var(--muted-gray-3)" }}>No friends yet</div>
              )}
            </Card>

          <Card title="Stats">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.8 }}>Games played</span><b>{data.stats.gamesPlayed}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.8 }}>Total chat</span><b>{data.stats.totalChats}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.8 }}>✅ received</span><b>{data.stats.totalPlus}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.8 }}>❌ received</span><b>{data.stats.totalMinus}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.8 }}>POV wins</span><b>{data.stats.totalPov}</b></div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
