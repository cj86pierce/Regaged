"use client";

import CastingVoteBox from "./CastingVoteBox";
import CastingMiniGame from "./CastingMiniGame";

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

  meUserId: string | null;
  myMiniGameScore: number;
  onRefresh: () => Promise<void>;

  // vote
  nominees: { userId: string; username: string }[];
  onSavedVotes: () => Promise<void>;

  messages: Message[];
}) {
  const showVote = props.state === "ROUND_VOTE" && props.nominees.length >= 3;
  const showMiniGame =
    props.state === "ROUND_VOTE" || props.state === "ROUND_NOMINATE";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* MINI GAME */}
      {showMiniGame && (
        <CastingMiniGame
          gameId={props.gameId}
          meUserId={props.meUserId}
          myScore={props.myMiniGameScore}
          onSubmitScore={props.onRefresh}
        />
      )}

      {/* VOTE */}
      {showVote && (
        <CastingVoteBox
          gameId={props.gameId}
          nominees={props.nominees}
          onSaved={props.onSavedVotes}
        />
      )}

      {/* READ THIS */}
      <div className="theme-sidebar-panel" style={{ borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Read this</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
          <b>Castings</b> runs in 12-hour days.<br />
          Play the mini game—lower score = more likely to be nominated.<br />
          Drops (🍎 / 🔑 / 🧪) appear in chat and are first-come first-serve.<br />
          Nominees are the 3 lowest mini-game scores, then everyone votes.<br />
          Final 4 is decided by <b>health → keys → checks</b>.
        </div>
      </div>

      {/* STORY */}
      <div className="theme-sidebar-panel" style={{ padding: 12, maxHeight: 260, overflowY: "auto" }}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>Story</div>

        {/* show recent system lines as “story” */}
        <div style={{ display: "grid", gap: 8 }}>
          {props.messages
            .filter((m) => m.isSystem)
            .slice(0, 12)
            .map((m) => (
              <div
                key={m.id}
                className="theme-chat-msg-sys"
                style={{ fontSize: 12, opacity: 0.8, border: "1px solid var(--border)", borderRadius: 10, padding: 8 }}
              >
                <div className="theme-username" style={{ marginBottom: 4 }}>{m.username}</div>
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
