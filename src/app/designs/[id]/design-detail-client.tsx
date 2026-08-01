"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Avatar, { type AvatarConfig, type SlotDesignType } from "@/components/Avatar";
import DesignImage from "@/components/DesignImage";

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

const DESIGN_TYPE_LABELS: Record<string, string> = {
  BODY: "Body",
  HAIR: "Hair",
  EYES: "Eyes",
  MOUTH: "Mouth",
  SHIRT: "Shirt",
  ACCESSORY: "Accessory",
  BACKGROUND: "Background",
  SCAR: "Scar",
  HAIR_ORNAMENT: "Hair ornament",
  GLASSES: "Glasses",
};

type Design = {
  id: string;
  title: string;
  description: string;
  designType?: string;
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState<AvatarConfig | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDesignOn, setPreviewDesignOn] = useState(true);

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

  async function openPreview() {
    setShowPreview(true);
    setPreviewError(null);
    setPreviewAvatar(null);
    setPreviewLoading(true);
    const res = await fetch("/api/me/avatar", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    setPreviewLoading(false);
    if (!res.ok) {
      setPreviewError(res.status === 401 ? "Log in to preview this design on your avatar." : json?.error ?? "Could not load avatar.");
      return;
    }
    setPreviewAvatar(json.avatar ?? null);
  }

  function closePreview() {
    setShowPreview(false);
    setPreviewAvatar(null);
    setPreviewError(null);
  }

  return (
    <div>
      <div className="theme-card" style={{ padding: 18, marginBottom: 14 }}>
        <div
          className="designDetailImage"
          style={{
            width: 240,
            maxWidth: "100%",
            height: Math.round((240 * 230) / 200),
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            marginBottom: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <DesignImage src={`/api/designs/${design.id}/image`} alt={design.title} />
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "clamp(18px, 5vw, 24px)", fontWeight: 1000 }}>{design.title}</h1>
        {design.designType && (
          <div style={{ fontSize: 12, color: "var(--link-color)", fontWeight: 800, marginBottom: 6 }}>
            {DESIGN_TYPE_LABELS[design.designType] ?? design.designType}
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          by{" "}
          <Link href={`/u/${design.author.username.toLowerCase()}`} className="theme-username" style={{ fontWeight: 800 }}>
            {design.author.username}
          </Link>
          {" · "}
          {new Date(design.createdAt).toLocaleString()}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {ended ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Voting closed · ✅ {design.plus} ❌ {design.minus}
            </div>
          ) : (
            <>
              <button
                onClick={() => voteDesign("PLUS")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: design.myVote === "PLUS" ? "2px solid var(--vote-plus-border)" : "1px solid var(--border)",
                  background: design.myVote === "PLUS" ? "var(--vote-plus-bg)" : "var(--bg-card)",
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
                  border: design.myVote === "MINUS" ? "2px solid var(--vote-minus-border)" : "1px solid var(--border)",
                  background: design.myVote === "MINUS" ? "var(--vote-minus-bg)" : "var(--bg-card)",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ❌ {design.minus}
              </button>
            </>
          )}
          <span style={{ fontSize: 16, fontWeight: 1000 }}>Score: {design.score}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{timeLabel}</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={openPreview}
            className="theme-btn-secondary"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 1000,
              fontSize: 15,
              cursor: "pointer",
              width: "100%",
              maxWidth: 280,
            }}
          >
            Preview on my avatar
          </button>
        </div>

        <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5 }}>{design.description}</div>
      </div>

      {/* Preview modal: avatar + design overlay */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview design on your avatar"
          onClick={closePreview}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              borderRadius: 14,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              maxWidth: 360,
              width: "100%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>Preview on your avatar</div>
              <button
                onClick={closePreview}
                style={{
                  border: "none",
                  background: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                ×
              </button>
            </div>
            {previewLoading && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
            )}
            {previewError && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-error)" }}>{previewError}</div>
            )}
            {!previewLoading && !previewError && previewAvatar && (
              <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
                <div style={{ position: "relative", width: 200, height: 230 }}>
                  <Avatar
                    config={previewAvatar}
                    width={200}
                    slotDesigns={
                      previewDesignOn && design.designType
                        ? { [design.designType as SlotDesignType]: `/api/designs/${design.id}/image` }
                        : undefined
                    }
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setPreviewDesignOn((on) => !on)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: previewDesignOn ? "var(--accent-bg)" : "var(--bg-btn-disabled)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {previewDesignOn ? "Hide design" : "Show design"}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  This is how the design would look on your avatar. Win it in the Auction House to use it.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10, fontWeight: 1000, fontSize: 16 }}>Comments ({design.comments.length})</div>

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
        {design.comments.map((c) => (
          <div key={c.id} className="theme-chat-msg" style={{ borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <Link
                  href={`/u/${c.author.username.toLowerCase()}`}
                  className="theme-username"
                  style={{ fontWeight: 800, fontSize: 13 }}
                >
                  {c.author.username}
                </Link>
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
                  <span style={{ fontSize: 12, color: "var(--muted-gray-3)" }}>
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
