"use client";

import Link from "next/link";
import {
  parseStructuredSystemMessage,
  type SystemMessagePayload,
} from "@/lib/systemMessageTypes";

type LegacySysRow = { name: string; points: number; tag: string };

/** Parse legacy body format (e.g. [SYSTEM:NOM_VOTES], [SYSTEM:EVICT_VOTES]) */
function parseLegacySystemRows(body: string): { kind: "NOM" | "EVICT"; rows: LegacySysRow[] } | null {
  if (body.startsWith("[SYSTEM:NOM_VOTES]")) {
    const lines = body.split("\n").slice(1).filter(Boolean);
    const rows = lines.map((ln) => {
      const [name, pts, tag] = ln.split("|");
      return { name: name ?? "?", points: Number(pts ?? "0"), tag: tag ?? "" };
    });
    return { kind: "NOM", rows };
  }
  if (body.startsWith("[SYSTEM:EVICT_VOTES]")) {
    const lines = body.split("\n").slice(1).filter(Boolean);
    const rows = lines.map((ln) => {
      const [name, pts, tag] = ln.split("|");
      return { name: name ?? "?", points: Number(pts ?? "0"), tag: tag ?? "" };
    });
    return { kind: "EVICT", rows };
  }
  return null;
}

/** Parse drop event ID from body (legacy [CASTDROP:...]) */
export function parseDropId(body: string): string | null {
  const m = /^\[CASTDROP:([a-z0-9]+)\]$/i.exec((body ?? "").trim());
  return m ? m[1] : null;
}

type DropEvent = {
  eventId: string;
  claimedAt: string | null;
  options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[];
};

type Props = {
  messageId: string;
  body: string;
  createdAt: string;
  dropEvent?: DropEvent | null;
  onClaim?: (eventId: string, slotIndex: number) => Promise<void>;
  meUserId: string | null;
  claiming?: Record<string, boolean>;
};

function iconFor(kind: "APPLE" | "KEY" | "POISON") {
  if (kind === "APPLE") return "🍎";
  if (kind === "KEY") return "🔑";
  return "🧪";
}

/** Shared system message renderer. Supports structured payloads and legacy body formats. */
export default function SystemMessageRenderer(props: Props) {
  const { messageId, body, createdAt, dropEvent, onClaim, meUserId, claiming = {} } = props;

  // 1. Try structured format
  const structured = parseStructuredSystemMessage(body);
  if (structured) {
    return <StructuredRender payload={structured} createdAt={createdAt} />;
  }

  // 2. Legacy drop ([CASTDROP:...])
  const dropId = parseDropId(body);
  if (dropId && dropEvent) {
    const claimed = !!dropEvent.claimedAt;
    const busy = claiming[dropId] === true;
    return (
      <div className="theme-chat-msg-sys" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>
          Drop {claimed ? <span style={{ fontSize: 12, opacity: 0.75 }}>(claimed)</span> : null}
        </div>
        {claimed ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>This drop was claimed.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {(dropEvent.options ?? []).map((o) => (
              <button
                key={o.slotIndex}
                onClick={() => onClaim?.(dropId, o.slotIndex)}
                disabled={!meUserId || busy}
                style={{
                  padding: "10px 0",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: busy ? "var(--bg-btn-disabled)" : "var(--bg-card)",
                  cursor: busy ? "not-allowed" : "pointer",
                  fontSize: 18,
                }}
                title={o.kind}
              >
                {iconFor(o.kind)}
              </button>
            ))}
          </div>
        )}
        {!meUserId && !claimed && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Login to claim.</div>
        )}
      </div>
    );
  }

  // 3. Legacy NOM/EVICT blocks
  const legacy = parseLegacySystemRows(body);
  if (legacy) {
    const title = legacy.kind === "NOM" ? "Nomination votes" : "Eviction votes";
    return (
      <div
        key={messageId}
        className="theme-chat-msg-sys"
        style={{
          padding: 8,
          marginBottom: 6,
          border: "1px solid rgba(0,0,0,0.18)",
          borderRadius: 10,
          background: "var(--bg-msg-system)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>{title}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{new Date(createdAt).toLocaleString()}</div>
        </div>
        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
          {legacy.rows.map((r, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 62px 52px",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px",
                borderRadius: 8,
                background: "var(--bg-msg)",
              }}
            >
              <div className="theme-username" style={{ fontSize: 12 }}>{r.name}</div>
              <div style={{ fontSize: 11 }}>
                <span style={{ fontWeight: 900 }}>{r.points}</span> pts
              </div>
              <div style={{ justifySelf: "end" }}>
                {r.tag ? (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "#111",
                      color: "#ffeb3b",
                      fontWeight: 1000,
                      fontSize: 11,
                    }}
                  >
                    {r.tag}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. Fallback: plain system text (strip [SYSTEM] prefix)
  const text = body.replace(/^\[SYSTEM\]\s*/i, "");
  return (
    <div
      className="theme-chat-msg-sys"
      style={{
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-msg-system)",
      }}
    >
      <div style={{ fontWeight: 1000, color: "var(--text-game)" }}>SYSTEM</div>
      <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-game)", whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>{new Date(createdAt).toLocaleString()}</div>
    </div>
  );
}

function StructuredRender({
  payload,
  createdAt,
}: {
  payload: SystemMessagePayload;
  createdAt: string;
}) {
  const time = new Date(createdAt).toLocaleString();

  switch (payload.type) {
    case "DAY_CHANGE":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>Day {payload.dayNumber} {payload.phase === "vote" ? "voting" : "nominations"} has begun.</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    case "NOMINATION":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>Nominees</div>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {payload.nominees.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="theme-username">{n.username ?? n.playerId}</span>
                {n.votes != null && <span style={{ fontSize: 11 }}>{n.votes} pts</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    case "VOTE_RESULT":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 12 }}>Vote results</div>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {payload.results.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="theme-username">{r.username ?? r.playerId}</span>
                <span style={{ fontWeight: 900 }}>{r.votes}</span>
                {r.tag && <span style={{ fontSize: 11, color: "#ffeb3b" }}>{r.tag}</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    case "PLAYER_ELIMINATED":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000 }}>{payload.username ?? payload.playerId} eliminated{payload.votes != null ? ` (${payload.votes} votes)` : ""}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    case "POV_RESULT":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000 }}>POV awarded to {payload.username ?? payload.playerId}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    case "GAME_FINISHED":
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontWeight: 1000 }}>Game finished!</div>
          <div style={{ marginTop: 6 }}>
            {payload.placements.map((p) => (
              <div key={p.playerId}>{p.place}. {p.username ?? p.playerId}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{time}</div>
        </div>
      );
    default:
      return (
        <div className="theme-chat-msg-sys" style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{payload.type}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{time}</div>
        </div>
      );
  }
}
