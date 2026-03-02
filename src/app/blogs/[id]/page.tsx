export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { getBlogPost } from "@/lib/getBlogPost";
import BlogPostClient from "./blog-post-client";

export default async function BlogPostPage({ params }: { params: { id: string } }) {
  const userId = await getCurrentUserIdFromHeaders();
  const postId = params.id;
  if (!postId) {
    return (
      <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
        <p>Invalid post.</p>
        <Link href="/blogs">← Back to blogs</Link>
      </main>
    );
  }
  const post = await getBlogPost(postId, userId ?? null);
  if (!post) {
    return (
      <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
        <p>Post not found.</p>
        <Link href="/blogs">← Back to blogs</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/blogs" style={{ fontWeight: 800, fontSize: 13, color: "#0b5ed7" }}>
          ← Back to blogs
        </Link>
      </div>
      <BlogPostClient initialPost={post} />
    </main>
  );
}
