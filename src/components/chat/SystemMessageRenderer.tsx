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
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
  flexWrap: "wrap",
};
const POINTS_BOX_STYLE: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  background: "var(--bg-btn-send)",
  color: "var(--text-btn-send)",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid var(--border)",
};
const TAG_BOX_STYLE: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  background: "var(--bg-btn-send)",
  color: "var(--text-btn-send)",
  fontWeight: 1000,
  fontSize: 11,
  border: "1px solid var(--border)",
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
  const m = /\[CASTDROP:([a-z0-9_-]+)\]/i.exec((body ?? "").trim());
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
  if (dropId) {
    if (dropEvent) {
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
    // dropId present but no dropEvent - show drop card, avoid raw text
    return (
      <SysMsgCard title="Drop" createdAt={createdAt}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Refresh the page to load this drop.</div>
      </SysMsgCard>
    );
  }

  // 3. Legacy NOM/EVICT blocks
  const legacy = parseLegacySystemRows(body);
  if (legacy) {
    const title = legacy.kind === "NOM" ? "Nomination votes" : "Eviction votes";
    return (
      <SysMsgCard key={messageId} title={title} createdAt={createdAt}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {legacy.rows.map((r, idx) => (
            <div key={idx} style={SYS_ROW_STYLE}>
              <Link href={`/u/${encodeURIComponent(r.name.toLowerCase())}`} className="theme-username" style={{ fontWeight: 800, color: "var(--link-color)" }}>{r.name}</Link>
              <span style={POINTS_BOX_STYLE}>{r.points}</span>
              <span style={{ fontSize: 12 }}>points</span>
              {r.tag ? <span style={TAG_BOX_STYLE}>{r.tag}</span> : null}
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
        <SysMsgCard title="Nomination votes" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {payload.nominees.map((n, i) => (
              <div key={i} style={SYS_ROW_STYLE}>
                <Link href={`/u/${encodeURIComponent((n.username ?? n.playerId).toLowerCase())}`} className="theme-username" style={{ fontWeight: 800, color: "var(--link-color)" }}>{n.username ?? n.playerId}</Link>
                <span style={POINTS_BOX_STYLE}>{n.votes ?? 0}</span>
                <span style={{ fontSize: 12 }}>points</span>
                <span style={TAG_BOX_STYLE}>NOM</span>
              </div>
            ))}
          </div>
        </SysMsgCard>
      );
    case "VOTE_RESULT":
      return (
        <SysMsgCard title="Eviction votes" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {payload.results.map((r, i) => (
              <div key={i} style={SYS_ROW_STYLE}>
                <Link href={`/u/${encodeURIComponent((r.username ?? r.playerId).toLowerCase())}`} className="theme-username" style={{ fontWeight: 800, color: "var(--link-color)" }}>{r.username ?? r.playerId}</Link>
                <span style={POINTS_BOX_STYLE}>{r.votes}</span>
                <span style={{ fontSize: 12 }}>points</span>
                {r.tag ? <span style={TAG_BOX_STYLE}>{r.tag}</span> : null}
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
        <SysMsgCard title="Winners" createdAt={createdAt}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {payload.placements.map((p) => (
              <div key={p.playerId} style={SYS_ROW_STYLE}>
                <span style={{ fontWeight: 800 }}>{p.place}.</span>
                <Link href={`/u/${encodeURIComponent((p.username ?? p.playerId).toLowerCase())}`} className="theme-username" style={{ fontWeight: 800, color: "var(--link-color)" }}>{p.username ?? p.playerId}</Link>
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
