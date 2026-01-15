"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Avatar, { AvatarConfig } from "@/components/Avatar";

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
  colorName: string;
  colorAnimated: boolean;
  lastSeenAt: string;
  bio: string;

  avatar: AvatarConfig;

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
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 1000 }}>
        {title}
      </div>
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

function onlineLabel(lastSeenAtIso: string) {
  const ms = Date.now() - new Date(lastSeenAtIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins <= 2) return "online";
  if (mins <= 60) return `${mins} min ago`;
  return "offline";
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

function StatLine({ label, value, suffixText }: { label: string; value: React.ReactNode; suffixText?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px auto 1fr", alignItems: "center", gap: 10, marginTop: 8 }}>
      <div style={{ fontSize: 22, color: "#666" }}>{label}</div>
      <div style={{ padding: "6px 10px", background: "#e6e6e6", borderRadius: 4, fontSize: 26, fontWeight: 1000, lineHeight: 1 }}>
        {value}
      </div>
      {suffixText ? <div style={{ fontSize: 22, color: "#666" }}>{suffixText}</div> : <div />}
    </div>
  );
}

function Bubble({ g }: { g: ProfileGameBubble }) {
  const isActiveGame = g.state !== "COMPLETED" && g.yourStatus === "ACTIVE";
  const isFilling = g.state === "ENROLLING" && g.yourStatus === "ACTIVE";

  const labelTop = g.gameType.toLowerCase();
  const labelBottom = isActiveGame ? (isFilling ? "filling" : "enter") : g.eliminatedPlace ? suffix(g.eliminatedPlace) : "—";

  return (
    <div style={{ textAlign: "center", width: 92 }}>
      <Link href={`/game/${g.gameId}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            border: "2px solid rgba(0,0,0,0.25)",
            background: isActiveGame ? "linear-gradient(#eaf2ff, #d6e6ff)" : "linear-gradient(#f3f6f9, #fff)",
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
              border: "1px solid rgba(0,0,0,0.20)",
              background: isActiveGame ? "#111" : "#fff",
              color: isActiveGame ? "#fff" : "#111",
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
  const last = useMemo(() => onlineLabel(data.lastSeenAt), [data.lastSeenAt]);
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
    <main style={{ padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        <Card title="Profile">
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 110px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", placeItems: "start" }}>
              <Avatar config={data.avatar} width={190} />
            </div>

            <div>
              {/* ✅ Wrap name + bar so bar spans under swatch too */}
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 38, fontWeight: 1000, color: "#2b83c6", lineHeight: 1 }}>
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
                    background: "#f3f6f9",
                    border: "1px solid rgba(0,0,0,0.08)",
                    zIndex: -1,
                  }}
                />
              </div>

              <StatLine label="Karma:" value={data.karma} />
              {data.isOwnProfile && <StatLine label="Money:" value={data.tMoney} suffixText="T$" />}
              <StatLine label="Played:" value={data.stats.gamesPlayed} suffixText="times" />

              <div style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
                Last Activity: <b>{last}</b>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>Joined {joinedLabel}</div>
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
          <div style={{ marginTop: 14, border: "1px solid rgba(0,0,0,0.18)", borderRadius: 10, background: "#fff9b8", padding: 12, minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 1000 }}>Bio</div>
              {data.isOwnProfile && (
                <button
                  onClick={() => {
                    setBioDraft(data.bio ?? "");
                    setBioMsg(null);
                    setEditingBio((v) => !v);
                  }}
                  style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.20)", background: "#fff", fontWeight: 1000, cursor: "pointer" }}
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
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.25)", resize: "vertical", fontFamily: "inherit" }}
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
                      background: bioSaving ? "#f3f6f9" : "#111",
                      color: bioSaving ? "#111" : "#fff",
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
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                {data.recentGames.map((g) => (
                  <Bubble key={g.gameId} g={g} />
                ))}
              </div>
            </Card>
          </div>
        </Card>

        {/* RIGHT */}
        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Participate!">
            <div style={{ display: "grid", gap: 10 }}>
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

              {data.isOwnProfile && (
                <Link
                  href="/profile/avatar"
                  style={{
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                    fontWeight: 1000,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "linear-gradient(#eaf2ff, #d6e6ff)",
                    color: "#0b2b66",
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                >
                  Customize Avatar
                </Link>
              )}
            </div>
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
