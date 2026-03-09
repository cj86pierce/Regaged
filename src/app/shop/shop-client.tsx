"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Me = { username: string; karma: number; tMoney: number; pMoney: number };

type ColorLevel = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

type AuctionDto = {
  id: string;
  designId: string;
  designTitle: string;
  designDescription: string;
  designAuthorUsername: string;
  endsAt: string;
  currentBid: number;
};

const SWATCH: Record<string, string> = {
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
  return SWATCH[name.trim().toLowerCase()] ?? "#ffffff";
}
function isTvStar(name: string) {
  return name.trim().toLowerCase() === "tv star";
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={active ? "theme-tab-btn-active" : "theme-tab-btn"}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        fontWeight: 1000,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function ShopClient({
  me,
  levels,
  ownedColorIds,
}: {
  me: Me;
  levels: ColorLevel[];
  ownedColorIds: number[];
}) {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const initialTab: "colors" | "items" | "auctions" =
    initialTabParam === "items"
      ? "items"
      : initialTabParam === "auctions"
      ? "auctions"
      : "colors";

  const [tab, setTab] = useState<"colors" | "items" | "auctions">(initialTab);

  const [auctions, setAuctions] = useState<AuctionDto[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [auctionsError, setAuctionsError] = useState<string | null>(null);

  const owned = useMemo(() => new Set([0, ...ownedColorIds]), [ownedColorIds]);
  const highestOwnedId = useMemo(() => {
    let max = 0;
    for (const id of owned) if (id > max) max = id;
    return max;
  }, [owned]);
  const nextBuyableId = highestOwnedId + 1;

  async function buyColor(colorId: number) {
    const res = await fetch("/api/shop/buy-color", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colorId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error ?? "Purchase failed");
    window.location.reload();
  }

  async function refreshAuctions() {
    setAuctionsLoading(true);
    setAuctionsError(null);
    try {
      const res = await fetch("/api/auctions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuctionsError(json?.error ?? "Failed to load auctions");
        setAuctions([]);
        return;
      }
      setAuctions(json.auctions ?? []);
    } catch {
      setAuctionsError("Failed to load auctions");
      setAuctions([]);
    } finally {
      setAuctionsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "auctions") {
      void refreshAuctions();
    }
  }, [tab]);

  async function bid(auctionId: string, delta: number) {
    const auction = auctions.find((a) => a.id === auctionId);
    if (!auction) return;
    const newAmount = auction.currentBid + delta;
    if (newAmount <= auction.currentBid) return;
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error ?? "Bid failed");
        return;
      }
      const currentBid = json.currentBid as number | undefined;
      if (typeof currentBid !== "number") return;
      setAuctions((prev) =>
        prev.map((a) => (a.id === auctionId ? { ...a, currentBid } : a)),
      );
    } catch {
      alert("Bid failed");
    }
  }

  const ShopBanner = ({ label, desc, tabKey, accent }: { label: string; desc: string; tabKey: "colors" | "items" | "auctions"; accent: string }) => (
    <button
      onClick={() => setTab(tabKey)}
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 0,
        width: "100%",
        textAlign: "left",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        background: tab === tabKey ? "var(--accent-bg)" : "var(--bg-card)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 180,
          height: 100,
          background: accent,
          display: "grid",
          placeItems: "center",
          fontSize: 32,
          opacity: 0.9,
        }}
      >
        {tabKey === "colors" && "🎨"}
        {tabKey === "items" && "👕"}
        {tabKey === "auctions" && "🔨"}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)", marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0, color: "var(--brand)", fontSize: 28 }}>Shops</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Choose a section below.</div>

      {/* Tengaged-style 4 banners: left image area, right text */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <ShopBanner label="Game Shops" desc="Avatar items and cosmetics. (Coming soon)" tabKey="items" accent="linear-gradient(135deg,#ffd85a,#ffb703)" />
        <ShopBanner label="Auctions" desc="Bid on designs. Latest designs from the community." tabKey="auctions" accent="linear-gradient(135deg,#e53935,#b71c1c)" />
        <ShopBanner label="Color Levels Shop" desc="Obtain higher color levels for vote weight and game access." tabKey="colors" accent="linear-gradient(135deg,#8e24aa,#4a148c)" />
        <ShopBanner label="Ads Shop" desc="Promotional tools. (Coming soon)" tabKey="items" accent="linear-gradient(135deg,#1e88e5,#0d47a1)" />
      </div>

      <div
        className="theme-sidebar-panel"
        style={{
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="theme-username" style={{ fontWeight: 1000 }}>{me.username}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-currency)", color: "var(--text-primary)" }}>
            Karma: <b>{me.karma}</b>
          </div>
          <div style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-currency)", color: "var(--text-primary)" }}>
            Money: <b>{me.tMoney}</b> R$
            <div style={{ fontSize: 11, opacity: 0.85 }}>Premium <b>{me.pMoney}</b> P$</div>
          </div>
        </div>
      </div>

      <div className="mobileWrapped" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <TabButton active={tab === "colors"} onClick={() => setTab("colors")}>
          Color Levels
        </TabButton>
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          Items (soon)
        </TabButton>
        <TabButton active={tab === "auctions"} onClick={() => setTab("auctions")}>
          Auction House
        </TabButton>
      </div>

      {tab === "colors" && (
        <>
          {/* Tengaged-style banner header */}
          <div
            className="theme-sidebar-panel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              marginBottom: 12,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)" }}>COLOR LEVELS SHOP</div>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "var(--brand)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 1000,
              }}
            >
              SALE
            </span>
            <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.85 }}>
              Items available <b>{levels.length}</b> Items are stock
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="shopColorGrid">
          {levels
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((lvl) => {
              const has = owned.has(lvl.id);

              const canKarma = me.karma >= lvl.karmaNeeded;
              const canMoney = me.tMoney >= lvl.priceT;

              const isNext = lvl.id === nextBuyableId;
              const isLockedByOrder = !has && lvl.id !== nextBuyableId && lvl.id !== 0;

              const canBuy = lvl.id !== 0 && !has && isNext && canKarma && canMoney;

              const sw = colorToSwatch(lvl.name);
              const tv = isTvStar(lvl.name);

              return (
                <div
                  key={lvl.id}
                  className="shopColorRow"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--bg-card)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    opacity: isLockedByOrder ? 0.65 : 1,
                  }}
                >
                  <div style={{ fontWeight: 1000, fontSize: 14, marginBottom: 8 }}>Level {lvl.name}</div>
                  <div
                    className={`lvlSwatch ${tv ? "tvstar" : ""} ${lvl.isAnimated || tv ? "animated" : "static"}`}
                    style={{ ["--lvl" as any]: sw, width: 48, height: 48, borderRadius: 10, marginBottom: 10 }}
                    title={lvl.name}
                  />
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Power: <b>{lvl.strength}</b></div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Karma: <b>{lvl.karmaNeeded}</b></div>
                  <div style={{ fontSize: 14, fontWeight: 1000, color: "var(--brand)", marginBottom: 10 }}>{lvl.priceT} R$</div>
                  {lvl.id === 0 && <div style={{ fontSize: 11, color: "#198754", fontWeight: 800 }}>Default</div>}
                  {has && lvl.id !== 0 && <div style={{ fontSize: 11, color: "#198754", fontWeight: 800 }}>Owned</div>}
                  {!has && isLockedByOrder && <div style={{ fontSize: 11, color: "#b02a37", fontWeight: 800 }}>Locked</div>}
                  {!has && isNext && (!canKarma || !canMoney) && (
                    <div style={{ fontSize: 11, color: "#b02a37", fontWeight: 800, marginBottom: 4 }}>
                      {canKarma ? "" : "Need karma. "}{canMoney ? "" : "Need R$."}
                    </div>
                  )}
                  <button
                    disabled={!canBuy}
                    onClick={() => buyColor(lvl.id)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: canBuy ? "var(--btn-primary-bg)" : "var(--bg-btn-disabled)",
                      fontWeight: 1000,
                      cursor: canBuy ? "pointer" : "not-allowed",
                    }}
                  >
                    {lvl.id === 0 ? "Owned" : has ? "Owned" : isNext ? "Buy" : "Locked"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "items" && (
        <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 1000 }}>More shop items soon.</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Next: avatar items, buttons, cosmetic frames, and more.</div>
        </div>
      )}

      {tab === "auctions" && (
        <div className="shopAuctionsLayout" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
          {/* Left: Designer earnings - Tengaged style */}
          <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12, height: "fit-content" }}>
            <div style={{ fontWeight: 1000, marginBottom: 10, color: "var(--brand)" }}>Designer earnings</div>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              {auctions.length === 0 && !auctionsLoading ? (
                <div style={{ opacity: 0.7 }}>No designer earnings yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {auctions.slice(0, 5).map((a) => (
                    <div key={a.id}>
                      <Link href={`/u/${encodeURIComponent(a.designAuthorUsername)}`} className="theme-username" style={{ textDecoration: "underline", fontSize: 12 }}>
                        {a.designAuthorUsername}
                      </Link>
                      <span style={{ opacity: 0.85 }}> won </span>
                      <b>{a.currentBid} T$</b>
                      <span style={{ opacity: 0.85 }}> as designer in auction </span>
                      <span style={{ opacity: 0.7 }}>recently</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Auction list - Tengaged style */}
          <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 4 }}>Auctions for Avatar Outfits</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>Latest Auctions</div>
            {auctionsLoading && <div style={{ fontSize: 12 }}>Loading auctions…</div>}
            {auctionsError && (
              <div style={{ fontSize: 12, color: "#b02a37", fontWeight: 900, marginBottom: 4 }}>{auctionsError}</div>
            )}
            {!auctionsLoading && auctions.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>No active auctions right now.</div>
            )}
            <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
              {auctions.map((a) => {
                const now = Date.now();
                const end = new Date(a.endsAt).getTime();
                const isClosed = end <= now;
                const timeLeft = isClosed ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
                const fmtTime = (s: number) => {
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return `${h}h ${m}m`;
                };
                return (
                  <div
                    key={a.id}
                    className="shopAuctionRow"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px minmax(0, 1fr) auto auto",
                      gap: 12,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      alignItems: "center",
                    }}
                  >
                    <div
                      className="shopAuctionThumb"
                      style={{
                        width: 100,
                        height: Math.round((100 * 230) / 200),
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--bg-input)",
                      }}
                    >
                      <img
                        src={`/api/designs/${a.designId}/image`}
                        alt={a.designTitle}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 14 }}>{a.designTitle}</div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>by {a.designAuthorUsername}</div>
                      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                        Current bid · {a.currentBid} T$
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 90 }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 1000,
                          background: isClosed ? "var(--bg-btn-disabled)" : "#e8f5e9",
                          color: isClosed ? "var(--text-muted)" : "#2e7d32",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {isClosed ? "CLOSED" : "OPEN"}
                      </span>
                      {!isClosed && (
                        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.85 }}>{fmtTime(timeLeft)} left</div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 1000, color: "var(--brand)" }}>{a.currentBid} T$</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => bid(a.id, 1)}
                          disabled={isClosed}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: "linear-gradient(#ffd85a,#ffb703)",
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: isClosed ? "not-allowed" : "pointer",
                            opacity: isClosed ? 0.6 : 1,
                          }}
                        >
                          Bid +1
                        </button>
                        <Link
                          href={`/designs/${a.designId}`}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--bg-card)",
                            fontSize: 12,
                            fontWeight: 800,
                            textDecoration: "none",
                            color: "var(--text-primary)",
                          }}
                        >
                          See Auction
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
