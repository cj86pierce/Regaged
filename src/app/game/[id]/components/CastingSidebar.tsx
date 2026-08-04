"use client";

import CastingVoteBox from "./CastingVoteBox";
import CarePackagePanel from "./CarePackagePanel";

type Message = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  username: string;
};

export default function CastingSidebar(props: {
  gameId: string;
  state: string;
  dayNumber: number;

  nominees: { userId: string; username: string }[];
  onSavedVotes: () => Promise<void>;

  messages: Message[];
  carePackages?: Array<{ eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }>;
  onReload?: () => Promise<void>;
  meUserId?: string | null;
}) {
  const showVote = props.state === "ROUND_VOTE" && props.nominees.length >= 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* CARE PACKAGES */}
      {props.carePackages && props.carePackages.length > 0 && props.onReload && (
        <CarePackagePanel
          gameId={props.gameId}
          carePackages={props.carePackages}
          onClaimed={props.onReload}
          meUserId={props.meUserId ?? null}
        />
      )}

      {/* VOTE */}
      {showVote && (
        <div style={{ flexShrink: 0 }}>
        <CastingVoteBox
          gameId={props.gameId}
          nominees={props.nominees}
          onSaved={props.onSavedVotes}
        />
        </div>
      )}

      {/* READ THIS */}
      <div
        className="theme-sidebar-panel"
        style={{ borderRadius: 4, padding: 12, flexShrink: 0 }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Read this</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
          <b>Castings</b> runs in 12-hour days.<br />
          <b>Nominations:</b> lowest challenge score, then lowest activity (checks).<br />
          <b>Keys</b> matter most at the end — final 5 ranks by <b>keys → challenge → checks</b>.<br />
          Play the daily Competition for your best challenge score (retries keep your best).<br />
          Public drops appear in chat (center slot = reward).<br />
          Every 3000 checks = private care package (see above).<br />
          At final 7 there are only 2 nominees.
        </div>
      </div>

      {/* STORY - stretches to fill */}
      <div
        className="theme-sidebar-panel"
        style={{
          padding: 12,
          flex: 1,
          minHeight: 120,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 8, flexShrink: 0 }}>Game Story</div>

        {/* show recent system lines as “story” */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {props.messages
            .filter((m) => m.isSystem)
            .slice(0, 12)
            .map((m) => (
              <div
                key={m.id}
                className="theme-chat-msg-sys"
                style={{
                  background: "var(--bg-msg-system)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="theme-username" style={{ fontWeight: 800 }}>{m.username}</span>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "var(--bg-msg)", borderRadius: 8, padding: 8 }}>
                  {m.body
                  .replace(/^\[SYSTEM\]\s*/i, "")
                  .replace(/^\[SYSTEM:[^\]]+\]\n?/i, "")
                  .replace(/^\[SYSMSG:[^\]]+\]\s*/i, "") || "System update"}
                </div>
              </div>
            ))}
        </div>

        {!props.messages.some((m) => m.isSystem) && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No story yet.</div>
        )}
      </div>
    </div>
  );
}
