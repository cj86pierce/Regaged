import Link from "next/link";
import { notFound } from "next/navigation";
import ColorLabClient from "./color-lab-client";

export const dynamic = "force-dynamic";

export default function ColorLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="pageShell" style={{ maxWidth: 980, margin: "0 auto" }}>
      <Link href="/shop/colors" style={{ fontSize: 13, opacity: 0.75, display: "inline-block", marginBottom: 10 }}>
        ← Color shop
      </Link>
      <h1 style={{ marginTop: 0, fontWeight: 1000 }}>Color lab</h1>
      <p style={{ fontSize: 14, opacity: 0.8, marginTop: 0, lineHeight: 1.45 }}>
        Localhost only. Large swatch is the shop tile; the small one is the profile belt.
      </p>
      <ColorLabClient />
    </main>
  );
}
