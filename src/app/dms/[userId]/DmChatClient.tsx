"use client";

import { useEffect, useState, useRef } from "react";

type Msg = {
  id: string;
  createdAt: string;
  senderUserId: string;
  senderUsername: string;
  recipientUserId: string;
  recipientUsername: string;
  body: string;
};

export default function DmChatClient({
  otherUserId,
  otherUsername,
}: {
  otherUserId: string;
  otherUsername: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dms/${otherUserId}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setMessages(json.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/dms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toUserId: otherUserId, text: t }),
      });
      const json = await res.json();
      if (res.ok && json.message) {
        setMessages((prev) => [json.message, ...prev]);
      } else {
        alert(json?.error ?? "Failed to send");
        setText(t);
      }
    } catch {
      alert("Failed to send");
      setText(t);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column-reverse",
          gap: 8,
          padding: 12,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-input)",
        }}
      >
        <div ref={bottomRef} />
        {messages.length === 0 && <div style={{ opacity: 0.7, textAlign: "center" }}>No messages yet. Say hi!</div>}
        {[...messages].reverse().map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.recipientUserId === otherUserId ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: 10,
              background: m.recipientUserId === otherUserId ? "var(--brand)" : "var(--bg-card)",
              color: m.recipientUserId === otherUserId ? "#fff" : "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 4 }}>{m.senderUsername}</div>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={500}
          rows={2}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            fontSize: 14,
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="theme-btn-primary"
          style={{ padding: "10px 16px" }}
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
