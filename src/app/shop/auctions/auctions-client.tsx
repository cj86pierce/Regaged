"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BidEntry = { username: string; amount: number; createdAt: string };

type AuctionDto = {
  id: string;
  designId: string;
  designTitle: string;
  designDescription: string;
  designAuthorUsername: string;
  endsAt: string;
  soldAt?: string | null;
  sold?: boolean;
  currentBid: number;
  currentBidUsername: string | null;
  winnerUserId?: string | null;
  winnerUsername?: string | null;
  bidHistory: BidEntry[];
};

function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function AuctionTimer({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const expired = left <= 0;

  return (
    <div style={{ fontSize: 12, fontWeight: 900, marginTop: 4 }}>
      {expired ? (
        <span style={{ opacity: 0.75 }}>Ending…</span>
      ) : (
        <span>
          Ends in <b style={{ color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>{fmtTimeLeft(left)}</b>
        </span>
      )}
    </div>
  );
}

export default function AuctionsClient({ meUserId }: { meUserId?: string | null }) {
  const [auctions, setAuctions] = useState<AuctionDto[]>([]);
  const [soldAuctions, setSoldAuctions] = useState<AuctionDto[]>([]);
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

  useEffect(() => {
    void refresh();
  }, []);

  const feed = useMemo(() => [...auctions, ...soldAuctions], [auctions, soldAuctions]);

  async function bid(auctionId: string, delta: number) {
    const a = auctions.find((x) => x.id === auctionId);
    if (!a || a.sold) return;
    const newAmount = a.currentBid + delta;
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json?.error ?? "Bid failed");
      const bidEntry: BidEntry = {
        username: json.currentBidUsername ?? "You",
        amount: json.currentBid ?? newAmount,
        createdAt: new Date().toISOString(),
      };
      setAuctions((prev) =>
        prev.map((x) =>
          x.id === auctionId
            ? {
                ...x,
                currentBid: json.currentBid ?? newAmount,
                currentBidUsername: json.currentBidUsername ?? x.currentBidUsername,
                bidHistory: [bidEntry, ...x.bidHistory],
              }
            : x
        )
      );
      void refresh();
    } catch {
      alert("Bid failed");
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Auctions</h1>
      <div
        className="shopAuctionsLayout"
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, marginTop: 12 }}
      >
        <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12, height: "fit-content" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10, color: "var(--brand)" }}>Recent sales</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {soldAuctions.length === 0 && !loading ? (
              <div style={{ opacity: 0.7 }}>No sales yet.</div>
            ) : (
              soldAuctions.slice(0, 8).map((a) => {
                const youWon = meUserId && a.winnerUserId === meUserId;
                return (
                  <div key={a.id} style={{ marginBottom: 10 }}>
                    {youWon ? (
                      <>
                        <span style={{ color: "var(--brand)", fontWeight: 800 }}>You won</span>
                        <span style={{ opacity: 0.85 }}> for </span>
                        <b>{a.currentBid} R$</b>
                        <div style={{ marginTop: 4 }}>
                          <Link
                            href="/profile/avatar"
                            style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}
                          >
                            Equip in Customize Avatar →
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/u/${encodeURIComponent(a.designAuthorUsername)}`}
                          className="theme-username"
                          style={{ textDecoration: "underline", fontSize: 12 }}
                        >
                          {a.designAuthorUsername}
                        </Link>
                        <span style={{ opacity: 0.85 }}> sold for </span>
                        <b>{a.currentBid} R$</b>
                        {a.winnerUsername ? (
                          <div style={{ opacity: 0.7, marginTop: 2 }}>
                            to {a.winnerUsername}
                          </div>
                        ) : null}
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
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
            Live auctions + sold log. Designs open at a 5 R$ seller bid — if nobody else bids, the designer keeps it free.
          </div>
          {loading && <div style={{ fontSize: 12 }}>Loading…</div>}
          {error && (
            <div style={{ fontSize: 12, color: "var(--error-inline)", fontWeight: 900 }}>{error}</div>
          )}
          {!loading && feed.length === 0 && !error && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>No auctions yet.</div>
          )}
          <div style={{ display: "grid", gap: 14, marginTop: 4 }}>
            {feed.map((a) => {
              const isSold = !!a.sold || !!a.soldAt;
              const history = [...a.bidHistory].reverse();
              return (
                <div
                  key={a.id}
                  className="shopAuctionRow"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px minmax(0, 1fr) 200px",
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: isSold ? "var(--bg-muted)" : "var(--bg-card)",
                    alignItems: "start",
                    opacity: isSold ? 0.92 : 1,
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
                      position: "relative",
                    }}
                  >
                    <img
                      src={`/api/designs/${a.designId}/image`}
                      alt={a.designTitle}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: isSold ? "grayscale(0.35)" : undefined,
                      }}
                    />
                    {isSold ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(0,0,0,0.35)",
                          color: "#fff",
                          fontWeight: 1000,
                          fontSize: 16,
                          letterSpacing: 1,
                        }}
                      >
                        SOLD
                      </div>
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 1000, fontSize: 14 }}>{a.designTitle}</div>
                      {isSold ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 1000,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "var(--brand)",
                            color: "#fff",
                          }}
                        >
                          SOLD
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>by {a.designAuthorUsername}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", marginTop: 4 }}>
                      {a.currentBid} R$
                      {isSold
                        ? a.winnerUsername
                          ? ` · Won by ${a.winnerUsername}`
                          : " · Sold"
                        : a.currentBidUsername
                          ? ` · Leading: ${a.currentBidUsername}`
                          : " · No bids yet"}
                    </div>
                    {!isSold ? <AuctionTimer endsAt={a.endsAt} /> : null}
                    {isSold && a.soldAt ? (
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                        Sold {new Date(a.soldAt).toLocaleString()}
                      </div>
                    ) : null}
                    {!isSold ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {[5, 25, 50, 100].map((d) => (
                          <button
                            key={d}
                            onClick={() => bid(a.id, d)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "var(--bid-btn-bg)",
                              color: "var(--bid-btn-text)",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            +{d}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <Link
                      href={`/designs/${a.designId}`}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 11,
                        color: "var(--brand)",
                        fontWeight: 700,
                        textDecoration: "underline",
                      }}
                    >
                      View design →
                    </Link>
                  </div>
                  <div
                    style={{
                      background: "var(--bg-muted)",
                      borderRadius: 8,
                      padding: 8,
                      maxHeight: 160,
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.8, marginBottom: 6 }}>
                      Bid history
                    </div>
                    {history.length === 0 ? (
                      <div style={{ fontSize: 11, opacity: 0.6 }}>No bids yet</div>
                    ) : (
                      history.map((b, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11,
                            padding: "4px 0",
                            borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                          }}
                        >
                          <span className="theme-username" style={{ fontWeight: 700 }}>
                            {b.username}
                          </span>{" "}
                          <span style={{ color: "var(--brand)", fontWeight: 800 }}>{b.amount} R$</span>
                          {" · "}
                          <span style={{ opacity: 0.7 }}>
                            {new Date(b.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))
                    )}
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
