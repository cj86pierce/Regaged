export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import Link from "next/link";

export default async function ShopPage() {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Shop</h1>
        <p>You must be logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  const banners = [
    { label: "Game Shops", desc: "Avatar items and cosmetics.", href: "/shop/game", accent: "linear-gradient(135deg,#ffd85a,#ffb703)", emoji: "👕" },
    { label: "Regaged Shop", desc: "Official avatar designs at fixed R$ prices. Buy once, equip anytime.", href: "/shop/regaged", accent: "linear-gradient(135deg,#f6c945,#e09f1f)", emoji: "🏪" },
    { label: "Auctions", desc: "Bid on designs. Latest designs from the community.", href: "/shop/auctions", accent: "linear-gradient(135deg,#e53935,#b71c1c)", emoji: "🔨" },
    { label: "Color Levels Shop", desc: "Obtain higher color levels for vote weight and game access.", href: "/shop/colors", accent: "linear-gradient(135deg,#8e24aa,#4a148c)", emoji: "🎨" },
    { label: "Ads Shop", desc: "Promotional tools. (Coming soon)", href: "/shop/ads", accent: "linear-gradient(135deg,#1e88e5,#0d47a1)", emoji: "📢" },
  ];

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0, color: "var(--brand)", fontSize: 28 }}>Shops</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Choose a section below.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {banners.map((b) => (
          <Link
            key={b.href}
            href={b.href}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 0,
              width: "100%",
              textAlign: "left",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--bg-card)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 180,
                height: 100,
                background: b.accent,
                display: "grid",
                placeItems: "center",
                fontSize: 32,
                opacity: 0.9,
              }}
            >
              {b.emoji}
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)", marginBottom: 6 }}>{b.label}</div>
              <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>{b.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
