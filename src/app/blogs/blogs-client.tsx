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
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "linear-gradient(#ffd85a, #ffb703)",
                color: "#3a2b00",
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              Write a post
            </button>
          ) : (
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 14,
                background: "#fff",
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.15)",
                  marginBottom: 8,
                  fontSize: 16,
                  fontWeight: 800,
                }}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Content (optional)"
                rows={4}
                maxLength={10000}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.15)",
                  marginBottom: 10,
                  fontSize: 14,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={createPost}
                  disabled={submitting || !title.trim()}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: submitting ? "#ccc" : "#111",
                    color: "#fff",
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
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                {error && <span style={{ fontSize: 13, color: "#c00" }}>{error}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>Loading...</div>
      ) : posts.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            border: "1px dashed rgba(0,0,0,0.2)",
            borderRadius: 12,
            background: "#f9fafb",
          }}
        >
          No posts yet. {userId ? "Be the first to write one!" : "Log in to write a post."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blogs/${p.id}`}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12,
                padding: 14,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 6 }}>{p.title}</div>
              {p.content && (
                <div
                  style={{
                    fontSize: 14,
                    color: "#444",
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
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#666" }}>
                <span>by {p.author.username}</span>
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
              border: "1px solid rgba(0,0,0,0.15)",
              background: page <= 1 ? "#f3f6f9" : "#fff",
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
              border: "1px solid rgba(0,0,0,0.15)",
              background: page >= totalPages ? "#f3f6f9" : "#fff",
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
