"use client";

import { useEffect, useRef } from "react";

type ChatMessage = {
  id: string;
  userId: string | null;
  username: string;
  content: string;
  createdAt: string;
  isSystem: boolean;
  isNew?: boolean;
};

export default function ChatPanel({
  messages,
}: {
  messages: ChatMessage[];
}) {
  const topRef = useRef<HTMLDivElement | null>(null);

  // Always keep newest messages at top
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 10,
        height: 520,
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      {/* Anchor for scroll */}
      <div ref={topRef} />

      {/* IMPORTANT: id used for scrolling */}
      <div id="nomsBox" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          height: "100%",
          overflow: "hidden",
        }}
      >
        {messages.map((m) => {
          const isSystem = m.isSystem;

          return (
            <div
              key={m.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 8px",
                background: isSystem
                  ? "var(--chat-msg-system)"
                  : m.isNew
                  ? "var(--chat-msg-new)"
                  : "var(--chat-msg-default)",
                transition: "background-color 0.4s ease",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: isSystem ? "var(--chat-username-system)" : "var(--chat-username)",
                }}
              >
                {isSystem ? "System" : m.username}
              </div>

              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{m.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
