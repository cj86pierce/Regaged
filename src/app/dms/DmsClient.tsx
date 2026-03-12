"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Conv = { userId: string; username: string; latestBody: string; latestAt: string; isIncoming: boolean; unread: boolean };

export default function DmsClient() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dms", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.redirect) window.location.href = json.redirect;
        else setError(json?.error ?? "Failed to load");
        setConversations([]);
      } else {
        setConversations(json.conversations ?? []);
      }
    } catch {
      setError("Failed to load");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <div style={{ fontSize: 13 }}>Loading…</div>;
  if (error) return <div style={{ color: "var(--text-error)", fontWeight: 900 }}>{error}</div>;

  if (conversations.length === 0) {
    return (
      <div className="theme-sidebar-panel" style={{ padding: 16, borderRadius: 12 }}>
        <div style={{ opacity: 0.8 }}>No messages yet.</div>
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Go to someone&apos;s profile and click ✉️ Message to start a conversation.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {conversations.map((c) => (
        <Link
          key={c.userId}
          href={`/dms/${c.userId}`}
          style={{
            display: "block",
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--border)",
                  background: c.unread ? "var(--accent-bg)" : "var(--bg-card)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontWeight: 1000, fontSize: 14 }} className="theme-username">
              {c.username}
            </div>
            {c.unread && (
              <span
                style={{
                  background: "var(--brand)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 900,
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
              >
                New
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{c.latestBody}{c.latestBody.length >= 60 ? "…" : ""}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{new Date(c.latestAt).toLocaleString()}</div>
        </Link>
      ))}
    </div>
  );
}
