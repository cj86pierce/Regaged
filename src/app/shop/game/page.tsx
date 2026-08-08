export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import Link from "next/link";

export default async function GameShopsPage() {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 12 }}>
        <p>You must be logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 12 }}>
      <Link href="/shop" style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, display: "inline-block" }}>
        ← Back to Shops
      </Link>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Game Shops</h1>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Official cosmetics and avatar items.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link
          href="/shop/regaged"
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
              background: "linear-gradient(135deg,#ffd85a,#ffb703)",
              display: "grid",
              placeItems: "center",
              fontSize: 32,
              opacity: 0.9,
            }}
          >
            🏪
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)", marginBottom: 6 }}>
              Regaged Shop
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
              Official avatar designs at fixed R$ prices. Buy once, equip anytime.
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
