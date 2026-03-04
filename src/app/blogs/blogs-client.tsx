"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Post = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
  plus: number;
  minus: number;
  score: number;
  commentCount: number;
  placement: number | null;
};

export default function BlogsClient({ userId }: { userId: string | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/blogs?page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [page]);

  async function createPost() {
    if (!userId || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/blogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: content.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(json?.error ?? "Failed to create");
    setShowForm(false);
    setTitle("");
    setContent("");
    setPage(1);
    fetch(`/api/blogs?page=1`)
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
      });
  }

  return (
    <div>
      {userId && (
        <div style={{ marginBottom: 14 }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="theme-btn-primary" style={{ cursor: "pointer" }}>
              Write a post
            </button>
          ) : (
            <div className="theme-sidebar-panel" style={{ padding: 14, borderRadius: 12 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={200}
                className="theme-chat-input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 8, fontSize: 16, fontWeight: 800 }}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Content (optional)"
                rows={4}
                maxLength={10000}
                className="theme-chat-input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 10, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={createPost}
                  disabled={submitting || !title.trim()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: submitting ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
                    color: submitting ? "var(--text-muted)" : "var(--text-btn-send)",
                    fontWeight: 1000,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Posting..." : "Post"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setTitle("");
                    setContent("");
                    setError(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                {error && <span style={{ fontSize: 13, color: "var(--text-error)" }}>{error}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>Loading...</div>
      ) : posts.length === 0 ? (
        <div className="theme-sidebar-panel" style={{ padding: 40, textAlign: "center", borderRadius: 12, borderStyle: "dashed" }}>
          No posts yet. {userId ? "Be the first to write one!" : "Log in to write a post."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <Link key={p.id} href={`/blogs/${p.id}`} className="theme-card" style={{ display: "block", textDecoration: "none", color: "inherit", padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {p.placement !== null && (
                  <span className="theme-btn-primary" style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                    #{p.placement}
                  </span>
                )}
                <span style={{ fontWeight: 1000, fontSize: 18 }}>{p.title}</span>
              </div>
              {p.content && (
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                    marginBottom: 8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {p.content}
                </div>
              )}
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)" }}>
                <span>by <span className="theme-username">{p.author.username}</span></span>
                <span>✅ {p.plus} ❌ {p.minus} · Score {p.score}</span>
                <span>{p.commentCount} comments</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
          <button
            onClick={() => setPage((x) => Math.max(1, x - 1))}
            disabled={page <= 1}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: page <= 1 ? "var(--bg-btn-disabled)" : "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: page <= 1 ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            ←
          </button>
          <span style={{ alignSelf: "center", fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
            disabled={page >= totalPages}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: page >= totalPages ? "var(--bg-btn-disabled)" : "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
