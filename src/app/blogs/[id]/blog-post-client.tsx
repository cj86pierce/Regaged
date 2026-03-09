"use client";

import { useState } from "react";
import Link from "next/link";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
  plus: number;
  minus: number;
  score: number;
  myVote: "PLUS" | "MINUS" | null;
};

type Post = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
  plus: number;
  minus: number;
  score: number;
  myVote: "PLUS" | "MINUS" | null;
  canVote: boolean;
  comments: (Comment & { canVote: boolean })[];
};

export default function BlogPostClient({ initialPost }: { initialPost: Post }) {
  const [post, setPost] = useState(initialPost);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function votePost(type: "PLUS" | "MINUS") {
    const res = await fetch(`/api/blogs/${post.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setPost((p) => ({
      ...p,
      plus: json.plus ?? p.plus,
      minus: json.minus ?? p.minus,
      score: json.score ?? p.score,
      myVote: json.myVote ?? type,
    }));
  }

  async function voteComment(commentId: string, type: "PLUS" | "MINUS") {
    const res = await fetch(`/api/blogs/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setPost((p) => ({
      ...p,
      comments: p.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              plus: json.plus ?? c.plus,
              minus: json.minus ?? c.minus,
              score: json.score ?? c.score,
              myVote: json.myVote ?? type,
            }
          : c
      ),
    }));
  }

  async function addComment() {
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/blogs/${post.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(json?.error ?? "Failed to comment");
    setPost((p) => ({
      ...p,
      comments: [...p.comments, json],
    }));
    setCommentText("");
  }

  return (
    <div>
      <div className="theme-card" style={{ padding: 18, marginBottom: 14 }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 1000 }}>{post.title}</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          by{" "}
          {post.author?.username ? (
            <Link href={`/u/${post.author.username.toLowerCase()}`} className="theme-username" style={{ fontWeight: 800 }}>
              {post.author.username}
            </Link>
          ) : (
            <span className="theme-username" style={{ fontWeight: 800 }}>[deleted user]</span>
          )}
          {" · "}
          {new Date(post.createdAt).toLocaleString()}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {post.canVote ? (
            <>
              <button
                onClick={() => votePost("PLUS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: post.myVote === "PLUS" ? "2px solid var(--vote-plus-border)" : "1px solid var(--border)",
                  background: post.myVote === "PLUS" ? "var(--vote-plus-bg)" : "var(--bg-card)",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ✅ {post.plus}
              </button>
              <button
                onClick={() => votePost("MINUS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: post.myVote === "MINUS" ? "2px solid var(--vote-minus-border)" : "1px solid var(--border)",
                  background: post.myVote === "MINUS" ? "var(--vote-minus-bg)" : "var(--bg-card)",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ❌ {post.minus}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Voting closed (post older than 3 days) · ✅ {post.plus} ❌ {post.minus}
            </div>
          )}
          <span style={{ fontSize: 16, fontWeight: 1000 }}>Score: {post.score}</span>
        </div>

        {post.content && (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{post.content}</div>
        )}
      </div>

      <div style={{ marginBottom: 10, fontWeight: 1000, fontSize: 16 }}>Comments ({post.comments.length})</div>

      <div style={{ marginBottom: 14 }}>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          maxLength={2000}
          className="theme-chat-input"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 8, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
        />
        <button
          onClick={addComment}
          disabled={submitting || !commentText.trim()}
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
          {submitting ? "Posting..." : "Comment"}
        </button>
        {error && <span style={{ marginLeft: 10, fontSize: 13, color: "var(--text-error)" }}>{error}</span>}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {post.comments.map((c) => (
          <div key={c.id} className="theme-chat-msg" style={{ borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                {c.author?.username ? (
                  <Link
                    href={`/u/${c.author.username.toLowerCase()}`}
                    className="theme-username"
                    style={{ fontWeight: 800, fontSize: 13 }}
                  >
                    {c.author.username}
                  </Link>
                ) : (
                  <span className="theme-username" style={{ fontWeight: 800, fontSize: 13 }}>[deleted]</span>
                )}
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {c.canVote ? (
                <>
                <button
                  onClick={() => voteComment(c.id, "PLUS")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: c.myVote === "PLUS" ? "2px solid var(--vote-plus-border)" : "1px solid var(--border)",
                    background: c.myVote === "PLUS" ? "var(--vote-plus-bg)" : "var(--bg-card)",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ✅ {c.plus}
                </button>
                <button
                  onClick={() => voteComment(c.id, "MINUS")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: c.myVote === "MINUS" ? "2px solid var(--vote-minus-border)" : "1px solid var(--border)",
                    background: c.myVote === "MINUS" ? "var(--vote-minus-bg)" : "var(--bg-card)",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ❌ {c.minus}
                </button>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{c.score}</span>
                </>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>✅ {c.plus} ❌ {c.minus} · {c.score}</span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.4 }}>
              {c.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
