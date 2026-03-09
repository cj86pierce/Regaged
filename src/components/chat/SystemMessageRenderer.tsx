"use client";

import Link from "next/link";
import {
  parseStructuredSystemMessage,
  type SystemMessagePayload,
} from "@/lib/systemMessageTypes";

type LegacySysRow = { name: string; points: number; tag: string };

const SYS_MSG_STYLE: React.CSSProperties = {
  background: "var(--bg-msg-system)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 12,
};
const SYS_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 62px 52px",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 10,
  background: "var(--bg-msg-system-row)",
  marginBottom: 6,
};
const OUT_TAG_STYLE: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 6,
  background: "#111",
  color: "#ffeb3b",
  fontWeight: 1000,
  fontSize: 11,
  border: "none",
};

function SysMsgCard({
  title,
  createdAt,
  children,
}: {
  title: string;
  createdAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="theme-chat-msg-sys" style={SYS_MSG_STYLE}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 1000 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(createdAt).toLocaleString()}</div>
      </div>
      {children}
    </div>
  );
}

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
      <SysMsgCard title={`Drop${claimed ? " (claimed)" : ""}`} createdAt={createdAt}>
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
      </SysMsgCard>
    );
  }

  // 3. Legacy NOM/EVICT blocks
  const legacy = parseLegacySystemRows(body);
  if (legacy) {
    const title = legacy.kind === "NOM" ? "Nomination votes" : "Eviction votes";
    return (
      <SysMsgCard key={messageId} title={title} createdAt={createdAt}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {legacy.rows.map((r, idx) => (
            <div key={idx} style={{ ...SYS_ROW_STYLE, marginBottom: 6 }}>
              <div className="theme-username" style={{ fontWeight: 800 }}>{r.name}</div>
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 900 }}>{r.points}</span> pts
              </div>
              <div style={{ justifySelf: "end" }}>
                {r.tag ? <span style={OUT_TAG_STYLE}>{r.tag}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </SysMsgCard>
    );
  }

  // 4. Fallback: plain system text (strip [SYSTEM] prefix)
  const text = body.replace(/^\[SYSTEM\]\s*/i, "");
  return (
    <SysMsgCard title="System" createdAt={createdAt}>
      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{text}</div>
    </SysMsgCard>
  );
}

function StructuredRender({
  payload,
  createdAt,
}: {
  payload: SystemMessagePayload;
  createdAt: string;
}) {
  switch (payload.type) {
    case "DAY_CHANGE":
      return (
        <SysMsgCard
          title={`Day ${payload.dayNumber} ${payload.phase === "vote" ? "voting" : "nominations"} has begun`}
          createdAt={createdAt}
        >
          <div style={{ fontSize: 13, minHeight: 4 }} />
        </SysMsgCard>
      );
    case "NOMINATION":
      return (
        <SysMsgCard title="Nominees" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {payload.nominees.map((n, i) => (
              <div key={i} style={{ ...SYS_ROW_STYLE }}>
                <span className="theme-username" style={{ fontWeight: 800 }}>{n.username ?? n.playerId}</span>
                <span style={{ fontSize: 12 }}>{n.votes != null ? `${n.votes} pts` : "—"}</span>
                <span />
              </div>
            ))}
          </div>
        </SysMsgCard>
      );
    case "VOTE_RESULT":
      return (
        <SysMsgCard title="Eviction votes" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {payload.results.map((r, i) => (
              <div key={i} style={{ ...SYS_ROW_STYLE }}>
                <span className="theme-username" style={{ fontWeight: 800 }}>{r.username ?? r.playerId}</span>
                <span style={{ fontSize: 12 }}><b>{r.votes}</b> pts</span>
                <div style={{ justifySelf: "end" }}>
                  {r.tag ? <span style={OUT_TAG_STYLE}>{r.tag}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </SysMsgCard>
      );
    case "PLAYER_ELIMINATED":
      return (
        <SysMsgCard
          title={`${payload.username ?? payload.playerId} eliminated${payload.votes != null ? ` (${payload.votes} votes)` : ""}`}
          createdAt={createdAt}
        >
          <div style={{ fontSize: 13, minHeight: 4 }} />
        </SysMsgCard>
      );
    case "POV_RESULT":
      return (
        <SysMsgCard title={`POV awarded to ${payload.username ?? payload.playerId}`} createdAt={createdAt}>
          <div style={{ fontSize: 13, minHeight: 4 }} />
        </SysMsgCard>
      );
    case "GAME_FINISHED":
      return (
        <SysMsgCard title="Game finished!" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {payload.placements.map((p) => (
              <div key={p.playerId} style={{ ...SYS_ROW_STYLE }}>
                <span className="theme-username" style={{ fontWeight: 800 }}>{p.place}. {p.username ?? p.playerId}</span>
                <span />
                <span />
              </div>
            ))}
          </div>
        </SysMsgCard>
      );
    default:
      return (
        <SysMsgCard title={payload.type} createdAt={createdAt}>
          <div style={{ fontSize: 13, minHeight: 4 }} />
        </SysMsgCard>
      );
  }
}
