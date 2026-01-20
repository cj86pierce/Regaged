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

  // optional story feed (you can keep using messages for this)
  messages: Message[];
}) {
  const showVote = props.state === "ROUND_VOTE" && props.nominees.length >= 3;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* VOTE */}
      {showVote && (
        <CastingVoteBox
          gameId={props.gameId}
          nominees={props.nominees}
          onSaved={props.onSavedVotes}
        />
      )}

      {/* READ THIS */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 12,
          background: "#fff",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Read this</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
          <b>Castings</b> runs in 12-hour days.<br />
          Drops (🍎 / 🔑 / 🧪) appear in chat and are first-come first-serve.<br />
          Nominees are automatically selected each day, then everyone votes using points.<br />
          Final 4 is decided by <b>health → keys → checks</b>.
        </div>
      </div>

      {/* STORY */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 12,
          background: "#fff",
          padding: 12,
          maxHeight: 260,
          overflowY: "auto",
        }}
      >
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Story</div>

        {/* show recent system lines as “story” */}
        <div style={{ display: "grid", gap: 8 }}>
          {props.messages
            .filter((m) => m.isSystem)
            .slice(0, 12)
            .map((m) => (
              <div
                key={m.id}
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  padding: 8,
                  background: "#fff9b8",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>{m.username}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
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
