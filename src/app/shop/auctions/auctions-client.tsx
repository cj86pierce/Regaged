"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuctionDto = {
  id: string;
  designId: string;
  designTitle: string;
  designDescription: string;
  designAuthorUsername: string;
  endsAt: string;
  currentBid: number;
};

type SoldAuctionDto = AuctionDto & { winnerUserId: string | null };

export default function AuctionsClient({ meUserId }: { meUserId?: string | null }) {
  const [auctions, setAuctions] = useState<AuctionDto[]>([]);
  const [soldAuctions, setSoldAuctions] = useState<SoldAuctionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auctions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Failed to load");
        setAuctions([]);
        setSoldAuctions([]);
      } else {
        setAuctions(json.auctions ?? []);
        setSoldAuctions(json.soldAuctions ?? []);
      }
    } catch {
      setError("Failed to load auctions");
      setAuctions([]);
      setSoldAuctions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function bid(auctionId: string, delta: number) {
    const a = auctions.find((x) => x.id === auctionId);
    if (!a) return;
    const newAmount = a.currentBid + delta;
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json?.error ?? "Bid failed");
      setAuctions((prev) =>
        prev.map((x) => (x.id === auctionId ? { ...x, currentBid: json.currentBid ?? newAmount } : x))
      );
    } catch {
      alert("Bid failed");
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Auctions</h1>
      <div className="shopAuctionsLayout" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, marginTop: 12 }}>
        <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12, height: "fit-content" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10, color: "var(--brand)" }}>Recent sales</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {soldAuctions.length === 0 && !loading ? (
              <div style={{ opacity: 0.7 }}>No sales yet.</div>
            ) : (
              soldAuctions.slice(0, 5).map((a) => {
                const youWon = meUserId && a.winnerUserId === meUserId;
                return (
                  <div key={a.id} style={{ marginBottom: 10 }}>
                    {youWon ? (
                      <>
                        <span style={{ color: "var(--brand)", fontWeight: 800 }}>You won</span>
                        <span style={{ opacity: 0.85 }}> for </span><b>{a.currentBid} R$</b>
                        <div style={{ marginTop: 4 }}>
                          <Link href="/profile/avatar" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>Equip in Customize Avatar →</Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href={`/u/${encodeURIComponent(a.designAuthorUsername)}`} className="theme-username" style={{ textDecoration: "underline", fontSize: 12 }}>
                          {a.designAuthorUsername}
                        </Link>
                        <span style={{ opacity: 0.85 }}> sold for </span><b>{a.currentBid} R$</b>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 4 }}>Auctions for Avatar Outfits</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>Latest Auctions</div>
          {loading && <div style={{ fontSize: 12 }}>Loading…</div>}
          {error && <div style={{ fontSize: 12, color: "var(--error-inline)", fontWeight: 900 }}>{error}</div>}
          {!loading && auctions.length === 0 && !error && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>No active auctions right now.</div>
          )}
          <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
            {auctions.map((a) => {
              const now = Date.now();
              const end = new Date(a.endsAt).getTime();
              const isClosed = end <= now;
              const timeLeft = isClosed ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
              const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
              return (
                <div
                  key={a.id}
                  className="shopAuctionRow"
                  style={{
                    display: "grid", gridTemplateColumns: "100px minmax(0, 1fr) auto auto",
                    gap: 12, padding: 10, borderRadius: 10, border: "1px solid var(--border)",
                    background: "var(--bg-card)", alignItems: "center",
                  }}
                >
                  <div
                    className="shopAuctionThumb"
                    style={{
                      width: 100, height: Math.round((100 * 230) / 200), borderRadius: 8,
                      overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-input)",
                    }}
                  >
                    <img src={`/api/designs/${a.designId}/image`} alt={a.designTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 1000, fontSize: 14 }}>{a.designTitle}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>by {a.designAuthorUsername}</div>
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Current bid · {a.currentBid} R$</div>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 90 }}>
                    <span
                      style={{
                        padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 1000,
                        background: isClosed ? "var(--bg-btn-disabled)" : "var(--open-badge-bg)",
                        color: isClosed ? "var(--text-muted)" : "var(--open-badge-text)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {isClosed ? "CLOSED" : "OPEN"}
                    </span>
                    {!isClosed && <div style={{ fontSize: 10, marginTop: 4, opacity: 0.85 }}>{fmt(timeLeft)} left</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 1000, color: "var(--brand)" }}>{a.currentBid} R$</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => bid(a.id, 1)}
                        disabled={isClosed}
                        style={{
                          padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                          background: "var(--bid-btn-bg)", color: "var(--bid-btn-text)", fontSize: 11, fontWeight: 900,
                          cursor: isClosed ? "not-allowed" : "pointer", opacity: isClosed ? 0.6 : 1,
                        }}
                      >
                        Bid +1
                      </button>
                      <Link
                        href={`/designs/${a.designId}`}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
                          background: "var(--bg-card)", fontSize: 12, fontWeight: 800,
                          textDecoration: "none", color: "var(--text-primary)",
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
    </>
  );
}
