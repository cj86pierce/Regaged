"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DESIGN_TYPES = [
  { value: "BODY", label: "Body" },
  { value: "HAIR", label: "Hair" },
  { value: "EYES", label: "Eyes" },
  { value: "MOUTH", label: "Mouth" },
  { value: "SHIRT", label: "Shirt" },
  { value: "ACCESSORY", label: "Accessory" },
] as const;

type Design = {
  id: string;
  title: string;
  description: string;
  designType?: string;
  authorUsername: string;
  createdAt: string;
  votingEndsAt: string;
  plus: number;
  minus: number;
  score: number;
  commentCount: number;
  canVote: boolean;
  myVote: "PLUS" | "MINUS" | null;
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

export default function DesignsClient({ userId }: { userId: string | null }) {
  const [recent, setRecent] = useState<Design[]>([]);
  const [top, setTop] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadDesignType, setUploadDesignType] = useState<string>("HAIR");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    fetch("/api/designs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setRecent(d.recent ?? []);
        setTop(d.top ?? []);
      })
      .catch(() => {
        setRecent([]);
        setTop([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !uploadFile || !uploadTitle.trim() || !uploadDescription.trim() || !uploadDesignType) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("title", uploadTitle.trim());
    fd.append("description", uploadDescription.trim());
    fd.append("designType", uploadDesignType);
    const res = await fetch("/api/designs", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(json?.error ?? "Upload failed");
      return;
    }
    setUploadTitle("");
    setUploadDescription("");
    setUploadDesignType("HAIR");
    setUploadFile(null);
    setShowForm(false);
    refresh();
  }

  return (
    <div>
      {userId && (
        <div style={{ marginBottom: 14 }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="theme-btn-primary" style={{ cursor: "pointer" }}>
              Submit a design
            </button>
          ) : (
            <div className="theme-sidebar-panel" style={{ padding: 14, borderRadius: 12 }}>
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Submit a design</div>
              <form onSubmit={handleUpload} style={{ display: "grid", gap: 8 }}>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={200}
                className="theme-chat-input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 16, fontWeight: 800 }}
                />
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  maxLength={2000}
                className="theme-chat-input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
                />
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Design type</label>
                  <select
                    value={uploadDesignType}
                    onChange={(e) => setUploadDesignType(e.target.value)}
                    required
                    className="theme-chat-input"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}
                  >
                    {DESIGN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  PNG, max 512KB. Top-voted designs in the 2-day window may go to the Auction House.
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile || !uploadTitle.trim() || !uploadDescription.trim() || !uploadDesignType}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: uploading ? "var(--bg-btn-disabled)" : "var(--bg-btn-send)",
                      color: uploading ? "var(--text-muted)" : "var(--text-btn-send)",
                      fontWeight: 1000,
                      cursor: uploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setUploadTitle("");
                      setUploadDescription("");
                      setUploadDesignType("HAIR");
                      setUploadFile(null);
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
              </form>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>Loading...</div>
      ) : (
        <>
          {top.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 10 }}>Top votes (in voting window)</div>
              <div style={{ display: "grid", gap: 12 }}>
                {top.map((d) => (
                  <DesignCard key={d.id} design={d} userId={userId} onVote={refresh} />
                ))}
              </div>
            </div>
          )}
          <div style={{ fontWeight: 1000, fontSize: 16, marginBottom: 10 }}>Recent</div>
          {recent.length === 0 ? (
            <div className="theme-sidebar-panel" style={{ padding: 40, textAlign: "center", borderRadius: 12, borderStyle: "dashed" }}>
              No designs yet. {userId ? "Submit one!" : "Log in to submit a design."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {recent.map((d) => (
                <DesignCard key={d.id} design={d} userId={userId} onVote={refresh} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DesignCard({
  design,
  userId,
  onVote,
}: {
  design: Design;
  userId: string | null;
  onVote: () => void;
}) {
  const [voting, setVoting] = useState(false);
  const timeLabel = formatTimeLeft(design.votingEndsAt);
  const ended = !design.canVote;

  async function vote(type: "PLUS" | "MINUS") {
    if (!userId || design.myVote === type || ended) return;
    setVoting(true);
    const res = await fetch(`/api/designs/${design.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setVoting(false);
    if (res.ok) onVote();
  }

  return (
    <Link href={`/designs/${design.id}`} className="theme-card" style={{ display: "block", textDecoration: "none", color: "inherit", padding: 14 }}>
      <div className="mobileStack" style={{ display: "flex", gap: 14 }}>
        <div
          className="designCardThumb"
          style={{
            width: 120,
            minWidth: 120,
            height: Math.round((120 * 230) / 200),
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            flexShrink: 0,
          }}
        >
          <img
            src={`/api/designs/${design.id}/image`}
            alt={design.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 1000, fontSize: 18 }}>{design.title}</span>
            {design.designType && (
              <span className="theme-btn-secondary" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6 }}>
                {DESIGN_TYPES.find((t) => t.value === design.designType)?.label ?? design.designType}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
            by {design.authorUsername} · {new Date(design.createdAt).toLocaleDateString()}
          </div>
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
            {design.description}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap", alignItems: "center" }}>
            {ended ? (
              <span style={{ color: "var(--text-muted)" }}>✅ {design.plus} ❌ {design.minus} · Score {design.score}</span>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    vote("PLUS");
                  }}
                  disabled={voting}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: design.myVote === "PLUS" ? `2px solid var(--vote-plus-border)` : "1px solid var(--border)",
                    background: design.myVote === "PLUS" ? "var(--vote-plus-bg)" : "var(--bg-card)",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: voting ? "not-allowed" : "pointer",
                  }}
                >
                  ✅ {design.plus}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    vote("MINUS");
                  }}
                  disabled={voting}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: design.myVote === "MINUS" ? `2px solid var(--vote-minus-border)` : "1px solid var(--border)",
                    background: design.myVote === "MINUS" ? "var(--vote-minus-bg)" : "var(--bg-card)",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: voting ? "not-allowed" : "pointer",
                  }}
                >
                  ❌ {design.minus}
                </button>
                <span style={{ fontWeight: 800 }}>Score {design.score}</span>
              </>
            )}
            <span style={ended ? { color: "var(--text-muted)" } : undefined}>{timeLabel}</span>
            <span>{design.commentCount} comments</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
