"use client";

import CastingVoteBox from "./CastingVoteBox";

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

  // vote
  nominees: { userId: string; username: string }[];
  onSavedVotes: () => Promise<void>;

  messages: Message[];
}) {
  const showVote = props.state === "ROUND_VOTE" && props.nominees.length >= 3;

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
        style={{ borderRadius: 12, padding: 12, flexShrink: 0 }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Read this</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
          <b>Castings</b> runs in 12-hour days.<br />
          Play the mini game—lower score = more likely to be nominated.<br />
          Drops (🍎 / 🔑 / 🧪) appear in chat and are first-come first-serve.<br />
          Nominees are the 3 lowest mini-game scores, then everyone votes.<br />
          Final 4 is decided by <b>health → keys → checks</b>.
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
        <div style={{ fontWeight: 1000, marginBottom: 8, flexShrink: 0 }}>Story</div>

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
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="theme-username" style={{ fontWeight: 800 }}>{m.username}</span>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "var(--bg-msg-system-row)", borderRadius: 8, padding: 8 }}>
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
