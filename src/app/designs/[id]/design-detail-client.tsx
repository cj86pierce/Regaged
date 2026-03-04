"use client";

import { useState, useEffect } from "react";
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
  canVote: boolean;
};

type Design = {
  id: string;
  title: string;
  description: string;
  author: { id: string; username: string };
  createdAt: string;
  votingEndsAt: string;
  plus: number;
  minus: number;
  score: number;
  myVote: "PLUS" | "MINUS" | null;
  canVote: boolean;
  comments: Comment[];
};

function formatTimeLeft(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  if (now >= end) return "Voting ended";
  const d = end - now;
  const hours = Math.floor(d / (60 * 60 * 1000));
  const mins = Math.floor((d % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Send to auction in ${days}d ${hours % 24}h`;
  }
  return `Send to auction in ${hours}h ${mins}m`;
}

export default function DesignDetailClient({ initialDesign }: { initialDesign: Design }) {
  const [design, setDesign] = useState(initialDesign);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setDesign((d) => ({ ...d, votingEndsAt: d.votingEndsAt }));
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function voteDesign(type: "PLUS" | "MINUS") {
    const res = await fetch(`/api/designs/${design.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setDesign((d) => ({
      ...d,
      plus: json.plus ?? d.plus,
      minus: json.minus ?? d.minus,
      score: json.score ?? d.score,
      myVote: json.myVote ?? type,
    }));
  }

  async function voteComment(commentId: string, type: "PLUS" | "MINUS") {
    const res = await fetch(`/api/designs/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setDesign((d) => ({
      ...d,
      comments: d.comments.map((c) =>
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
    const res = await fetch(`/api/designs/${design.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(json?.error ?? "Failed to comment");
    setDesign((d) => ({ ...d, comments: [...d.comments, json] }));
    setCommentText("");
  }

  const timeLabel = formatTimeLeft(design.votingEndsAt);
  const ended = !design.canVote;

  return (
    <div>
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 18,
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 200,
            height: 230,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#eee",
            marginBottom: 12,
          }}
        >
          <img
            src={`/api/designs/${design.id}/image`}
            alt={design.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 1000 }}>{design.title}</h1>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
          by{" "}
          <Link href={`/u/${design.author.username.toLowerCase()}`} style={{ fontWeight: 800, color: "#0b5ed7" }}>
            {design.author.username}
          </Link>
          {" · "}
          {new Date(design.createdAt).toLocaleString()}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {ended ? (
            <div style={{ fontSize: 13, color: "#888" }}>
              Voting closed (2-day window ended) · ✅ {design.plus} ❌ {design.minus}
            </div>
          ) : (
            <>
              <button
                onClick={() => voteDesign("PLUS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: design.myVote === "PLUS" ? "2px solid #2e7d32" : "1px solid rgba(0,0,0,0.15)",
                  background: design.myVote === "PLUS" ? "#e8f5e9" : "#fff",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ✅ {design.plus}
              </button>
              <button
                onClick={() => voteDesign("MINUS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: design.myVote === "MINUS" ? "2px solid #c62828" : "1px solid rgba(0,0,0,0.15)",
                  background: design.myVote === "MINUS" ? "#ffebee" : "#fff",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ❌ {design.minus}
              </button>
            </>
          )}
          <span style={{ fontSize: 16, fontWeight: 1000 }}>Score: {design.score}</span>
          <span style={{ fontSize: 13, color: ended ? "#888" : "#666" }}>{timeLabel}</span>
        </div>

        <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{design.description}</div>
      </div>

      <div style={{ marginBottom: 10, fontWeight: 1000, fontSize: 16 }}>Comments ({design.comments.length})</div>

      <div style={{ marginBottom: 14 }}>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          maxLength={2000}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            marginBottom: 8,
            fontSize: 14,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={addComment}
          disabled={submitting || !commentText.trim()}
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
          {submitting ? "Posting..." : "Comment"}
        </button>
        {error && <span style={{ marginLeft: 10, fontSize: 13, color: "#c00" }}>{error}</span>}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {design.comments.map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 10,
              padding: 12,
              background: "#f9fafb",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <Link
                  href={`/u/${c.author.username.toLowerCase()}`}
                  style={{ fontWeight: 800, fontSize: 13, color: "#0b5ed7" }}
                >
                  {c.author.username}
                </Link>
                <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>
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
                        border: c.myVote === "PLUS" ? "2px solid #2e7d32" : "1px solid rgba(0,0,0,0.12)",
                        background: c.myVote === "PLUS" ? "#e8f5e9" : "#fff",
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
                        border: c.myVote === "MINUS" ? "2px solid #c62828" : "1px solid rgba(0,0,0,0.12)",
                        background: c.myVote === "MINUS" ? "#ffebee" : "#fff",
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
                  <span style={{ fontSize: 12, color: "#888" }}>
                    ✅ {c.plus} ❌ {c.minus} · {c.score}
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.4 }}>{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
