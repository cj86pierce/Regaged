export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { getDesign } from "@/lib/getDesign";
import DesignDetailClient from "./design-detail-client";

export default async function DesignPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserIdFromHeaders();
  const designId = params.id;
  if (!designId) {
    return (
      <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
        <p>Invalid design.</p>
        <Link href="/designs">← Back to designs</Link>
      </main>
    );
  }
  const design = await getDesign(designId, userId ?? null);
  if (!design) {
    return (
      <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
        <p>Design not found.</p>
        <Link href="/designs">← Back to designs</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/designs" style={{ fontWeight: 800, fontSize: 13, color: "#0b5ed7" }}>
          ← Back to designs
        </Link>
      </div>
      <DesignDetailClient initialDesign={design} />
    </main>
  );
}
