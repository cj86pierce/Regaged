export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import DesignsClient from "./designs-client";

export default async function DesignsPage() {
  const userId = await getCurrentUserIdFromHeaders();

  return (
    <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>Designs</h1>
        <Link href="/shop" style={{ fontWeight: 800, fontSize: 13, color: "#0b5ed7" }}>
          Auction House →
        </Link>
      </div>
      <DesignsClient userId={userId ?? null} />
    </main>
  );
}
