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
      <Link href="/shop" style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, display: "inline-block" }}>← Back to Shops</Link>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Game Shops</h1>
      <div className="theme-sidebar-panel" style={{ padding: 16, borderRadius: 12, marginTop: 12 }}>
        <div style={{ fontWeight: 1000 }}>Coming soon</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Avatar items, cosmetics, and more.</div>
      </div>
    </main>
  );
}
