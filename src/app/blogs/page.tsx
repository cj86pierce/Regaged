export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import Link from "next/link";
import BlogsClient from "./blogs-client";

export default async function BlogsPage() {
  const userId = await getCurrentUserIdFromHeaders();

  return (
    <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>Blogs</h1>
        <Link href="/" style={{ fontWeight: 800, fontSize: 13, color: "#0b5ed7" }}>
          ← Home
        </Link>
      </div>
      <BlogsClient userId={userId ?? null} />
    </main>
  );
}
