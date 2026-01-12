"use client";

export default function Sidebar({
  phase,
  canVote,
  canNominate,
  hasVoted,
  hasNominated,
  onVote,
  onNominate,
}: {
  phase: "POV" | "NOMINATE" | "VOTE" | "WAIT";
  canVote: boolean;
  canNominate: boolean;
  hasVoted: boolean;
  hasNominated: boolean;
  onVote: () => void;
  onNominate: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        background: "#fff",
      }}
    >
      {/* IMPORTANT: id used for scroll */}
      <div id="voteBox" />

      <h3 style={{ marginBottom: 10 }}>Round Actions</h3>

      {phase === "NOMINATE" && (
        <button
          disabled={!canNominate || hasNominated}
          onClick={onNominate}
          style={buttonStyle}
        >
          {hasNominated ? "Nominations Locked" : "Nominate Players"}
        </button>
      )}

      {phase === "VOTE" && (
        <button
          disabled={!canVote || hasVoted}
          onClick={onVote}
          style={buttonStyle}
        >
          {hasVoted ? "Vote Locked In" : "Evict Player"}
        </button>
      )}

      {phase === "POV" && (
        <div style={infoStyle}>
          POV is being decided…
        </div>
      )}

      {phase === "WAIT" && (
        <div style={infoStyle}>
          Waiting for server to advance…
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
        <strong>How Fastings works:</strong>
        <ul style={{ paddingLeft: 18 }}>
          <li>POV is awarded first</li>
          <li>2 players are nominated</li>
          <li>Everyone else votes to evict</li>
          <li>Most votes = eliminated</li>
        </ul>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  fontWeight: 700,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const infoStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  background: "#f1f1f1",
  fontSize: 14,
};
