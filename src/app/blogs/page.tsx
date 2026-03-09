export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import Link from "next/link";
import BlogsClient from "./blogs-client";

export default async function BlogsPage() {
  const userId = await getCurrentUserIdFromHeaders();

  return (
    <main style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, alignItems: "start" }} className="blogsLayout">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h1 style={{ margin: 0, color: "var(--brand)" }}>❤ Blogs</h1>
            <Link href="/" style={{ fontWeight: 800, fontSize: 13, color: "var(--link-color)" }}>
              ← Home
            </Link>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Home</span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>·</span>
            <Link href="/profile" style={{ fontSize: 13, color: "var(--link-color)" }}>My Blog</Link>
          </div>
          <BlogsClient userId={userId ?? null} />
        </div>
        <div className="theme-sidebar-panel" style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", position: "sticky", top: 80 }}>
          <div style={{ fontWeight: 1000, marginBottom: 8, color: "var(--brand)" }}>TRENDING</div>
          <Link href="/blogs" style={{ fontSize: 12, color: "var(--link-color)" }}>view most browsed now</Link>
          <div style={{ marginTop: 16, fontWeight: 1000, marginBottom: 8, color: "var(--brand)" }}>TOP TODAY!!</div>
          <Link href="/blogs" style={{ fontSize: 12, color: "var(--link-color)" }}>view most liked now</Link>
        </div>
      </div>
    </main>
  );
}
