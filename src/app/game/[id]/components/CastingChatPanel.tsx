"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseDropId } from "@/components/chat/SystemMessageRenderer";
import "@/styles/tengagedChat.css";

type Message = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  plus: number;
  minus: number;
  myReaction: "PLUS" | "MINUS" | null;
  isSystem: boolean;
};

type DropEventsMap = Record<
  string,
  { eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }
>;

function chatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "";
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function stripSystemPrefix(body: string): string {
  return body
    .replace(/^\[SYSTEM\]\s*/i, "")
    .replace(/^\[SYSTEM:[^\]]+\]\n?/i, "")
    .replace(/^\[SYSMSG:[^\]]+\]\s*/i, "")
    .trim();
}

/** Make casting system copy easier to scan (works for old + new formats). */
function formatSystemText(body: string): { title: string; lines: string[] } {
  const text = stripSystemPrefix(body);
  const nom =
    text.match(/^Day\s+(\d+)\s+nominations\s*\nNominees:\s*(.+?)(?:\n|$)/i) ||
    text.match(/^Day\s+(\d+):\s*Nominees\s*[—\-–]\s*(.+?)(?:\.|$)/i);
  if (nom) {
    return {
      title: `Day ${nom[1]} nominations`,
      lines: [`Nominees: ${nom[2]!.replace(/\.\s*Vote now.*/i, "").trim()}`, "Assign 1, 2, and 3 points — each score once."],
    };
  }

  const voted = text.match(/^(.+?)\s+has been voted out\.?\s*(?:\n)?(?:Day\s+(\d+).*)?$/is);
  if (voted) {
    const day = voted[2] ? `Day ${voted[2]} is over.` : null;
    return {
      title: `${voted[1]!.trim()} has been voted out`,
      lines: day ? [day] : [],
    };
  }

  if (/^Day\s+1\s+complete/i.test(text)) {
    return {
      title: "Day 1 complete",
      lines: ["Competition day is over. Nominations begin on Day 2."],
    };
  }

  if (/^Castings finished/i.test(text)) {
    const lines = text
      .split("\n")
      .slice(1)
      .map((l) => l.replace(/^[-\u2013\u2014]\s*/, "").replace(/^(\d)(?:st|nd|rd|th)\s*[—\-:]\s*/i, "$1. ").trim())
      .filter(Boolean);
    return { title: "Castings finished", lines };
  }

  const died = text.match(/^(.+?)\s+died from inactivity\.?$/i);
  if (died) {
    return { title: "Inactivity", lines: [`${died[1]} left the house.`] };
  }

  const parts = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (parts.length <= 1) return { title: text || "Update", lines: [] };
  return { title: parts[0]!, lines: parts.slice(1) };
}

function iconFor(kind: "APPLE" | "KEY" | "POISON") {
  if (kind === "APPLE") return "🍎";
  if (kind === "KEY") return "🔑";
  return "🧪";
}

function CastingSystemBody(props: {
  body: string;
  drop?: DropEventsMap[string];
  meUserId: string | null;
  claiming: boolean;
  onClaim: (eventId: string, slotIndex: number) => void;
  enableDrops?: boolean;
}) {
  const dropId = props.enableDrops ? parseDropId(props.body) : null;
  if (dropId) {
    const drop = props.drop;
    const claimed = !!drop?.claimedAt;
    return (
      <div className="tgSysBody">
        <div className="tgSysTitle">{claimed ? "Drop claimed" : "Public drop"}</div>
        {!drop ? (
          <div className="tgSysLine">Refresh to load this drop.</div>
        ) : claimed ? (
          <div className="tgSysLine">Someone already claimed this drop.</div>
        ) : (
          <div className="tgSysDropSlots">
            {(drop.options ?? [])
              .slice()
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((o) => (
                <button
                  key={o.slotIndex}
                  type="button"
                  className="tgSysDropSlot"
                  disabled={!props.meUserId || props.claiming}
                  title={o.kind}
                  onClick={() => props.onClaim(dropId, o.slotIndex)}
                >
                  {iconFor(o.kind)}
                </button>
              ))}
          </div>
        )}
        {!props.meUserId && !claimed ? <div className="tgSysLine muted">Login to claim.</div> : null}
      </div>
    );
  }

  const { title, lines } = formatSystemText(props.body);
  return (
    <div className="tgSysBody">
      <div className="tgSysTitle">{title}</div>
      {lines.map((line, i) => (
        <div key={i} className="tgSysLine">
          {line}
        </div>
      ))}
    </div>
  );
}

/** Collapse exact duplicate system lines that landed from races (same text within a short window). */
function dedupeSystemMessages(messages: Message[]): Message[] {
  const out: Message[] = [];
  const seen = new Map<string, number>(); // key -> createdAt ms of kept msg
  for (const m of messages) {
    const dropId = parseDropId(m.body);
    const isSys = !!(dropId || m.isSystem);
    if (!isSys) {
      out.push(m);
      continue;
    }
    const key = stripSystemPrefix(m.body).replace(/\s+/g, " ").toLowerCase();
    // For noms, normalize old/new formats to same key by day number when possible
    const nomDay =
      key.match(/^day\s+(\d+)\s+nominations/) ||
      key.match(/^day\s+(\d+):\s*nominees/);
    const normKey = nomDay ? `noms:${nomDay[1]}` : key.startsWith("castings finished") ? "finished" : key;
    const t = new Date(m.createdAt).getTime();
    const prev = seen.get(normKey);
    if (prev != null && Math.abs(t - prev) < 6 * 60 * 60 * 1000) {
      // skip near-duplicate (keep first in list order — newest first typically)
      continue;
    }
    seen.set(normKey, t);
    out.push(m);
  }
  return out;
}

export default function CastingChatPanel(props: {
  gameId: string;
  meUserId: string | null;

  messages: Message[];
  dropEvents: DropEventsMap;

  chatText: string;
  setChatText: (v: string) => void;

  onSend: () => Promise<void>;
  onReact: (messageId: string, type: "PLUS" | "MINUS") => Promise<void>;

  onReload: () => Promise<void>;
  /** Casting-only public drops / claim UI */
  enableDrops?: boolean;
  systemLabel?: string;
}) {
  const {
    gameId,
    meUserId,
    messages,
    dropEvents,
    chatText,
    setChatText,
    onSend,
    onReact,
    onReload,
    enableDrops = false,
    systemLabel = "System",
  } = props;

  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reacting, setReacting] = useState<Record<string, boolean>>({});
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  const visibleMessages = useMemo(() => dedupeSystemMessages(messages), [messages]);

  async function safeSend() {
    if (!meUserId || sending || !chatText.trim()) return;
    setSending(true);
    try {
      await onSend();
    } finally {
      setSending(false);
    }
  }

  async function safeReact(messageId: string, type: "PLUS" | "MINUS") {
    if (!meUserId || reacting[messageId]) return;
    setReacting((p) => ({ ...p, [messageId]: true }));
    try {
      await onReact(messageId, type);
    } finally {
      setReacting((p) => ({ ...p, [messageId]: false }));
    }
  }

  async function claim(eventId: string, slotIndex: number) {
    if (!meUserId || claiming[eventId]) return;
    setClaimErr(null);
    setClaiming((p) => ({ ...p, [eventId]: true }));
    try {
      const res = await fetch(`/api/game/${gameId}/casting/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, slotIndex }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClaimErr(json?.error ?? "Claim failed");
        return;
      }
      await onReload();
    } finally {
      setClaiming((p) => ({ ...p, [eventId]: false }));
    }
  }

  return (
    <div className="tgChat">
      <div className="tgChatCompose">
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="Write a comment…"
          disabled={!meUserId || sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void safeSend();
            }
          }}
        />
        <button type="button" onClick={safeSend} disabled={!meUserId || sending || !chatText.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </div>

      <dl className="tgIngameMessages">
        {visibleMessages.map((m) => {
          const dropId = enableDrops ? parseDropId(m.body) : null;
          const drop = dropId ? dropEvents[dropId] : null;
          const isMe = !!meUserId && m.userId === meUserId && !m.isSystem && !dropId;
          const isSys = !!(dropId || m.isSystem);
          const busyReact = reacting[m.id] === true;
          const disableReact = !meUserId || m.myReaction !== null || busyReact || isSys;
          const net = m.plus - m.minus;
          const pts = net >= 0 ? `+${net}` : `${net}`;

          if (isSys) {
            return (
              <div key={m.id} className="tgSysPair">
                <dt className="system">
                  <span className="tgSysWho">{systemLabel}</span>
                  <span className="date">{chatAgo(m.createdAt)}</span>
                </dt>
                <dd className="body system">
                  <CastingSystemBody
                    body={m.body}
                    drop={enableDrops ? drop ?? undefined : undefined}
                    meUserId={meUserId}
                    claiming={!!(dropId && claiming[dropId])}
                    onClaim={(id, slot) => void claim(id, slot)}
                    enableDrops={enableDrops}
                  />
                </dd>
              </div>
            );
          }

          return (
            <div key={m.id} className="tgMsgPair">
              <dt className={isMe ? "me" : undefined}>
                <div className="tgChatMeta">
                  <span className="tgChatPts">{pts} points</span>
                  <span className="tgChatReact">
                    <button
                      type="button"
                      disabled={disableReact}
                      onClick={() => safeReact(m.id, "PLUS")}
                      title="Plus"
                      aria-label="Plus"
                      className={m.myReaction === "PLUS" ? "active plus" : "plus"}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      disabled={disableReact}
                      onClick={() => safeReact(m.id, "MINUS")}
                      title="Minus"
                      aria-label="Minus"
                      className={m.myReaction === "MINUS" ? "active minus" : "minus"}
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <Link href={`/u/${encodeURIComponent(m.username.toLowerCase())}`} className="user">
                  {m.username}
                </Link>
                <span className="date">{chatAgo(m.createdAt)}</span>
              </dt>
              <dd className={`body${isMe ? " me" : ""}`}>{m.body}</dd>
            </div>
          );
        })}
      </dl>

      {claimErr ? (
        <div style={{ marginTop: 10, color: "var(--text-error)", fontWeight: 800 }}>{claimErr}</div>
      ) : null}
    </div>
  );
}
