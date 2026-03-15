"use client";

import React from "react";
import Link from "next/link";

type Msg = { id: string; body: string; createdAt: string; isSystem: boolean };

export default function Sidebar(props: {
  gameState: string;
  roundNumber: number;

  nomSelected: string[];
  canConfirmNoms: boolean;
  onConfirmNoms: () => Promise<void>;
  myNomLockedIn: boolean;

  evictSelected: string | null;
  canConfirmVote: boolean;
  onConfirmVote: () => Promise<void>;
  myVoteLockedIn: string | null;

  messages?: Msg[];

  // Frookies: competition + POV save + HOH-only noms
  gameId?: string;
  gameType?: string;
  meUserId?: string | null;
  povUserId?: string | null;
  hohUserId?: string | null;
  povSavedUserId?: string | null;
  frookiesPhase?: string | null;
  players?: { userId: string; username: string; status: string }[];
  onPovSave?: (targetUserId: string | null) => Promise<void>;
  onReload?: () => void;
}) {
  const {
    gameState,
    roundNumber,
    nomSelected,
    canConfirmNoms,
    onConfirmNoms,
    myNomLockedIn,
    evictSelected,
    canConfirmVote,
    onConfirmVote,
    myVoteLockedIn,
    messages = [],
    gameId,
    gameType,
    meUserId,
    povUserId,
    hohUserId,
    povSavedUserId,
    frookiesPhase,
    players = [],
    onPovSave,
    onReload,
  } = props;

  const isFrookies = gameType === "FROOKIES" || gameType === "FROOKIES_BOT";
  const iAmPov = isFrookies && meUserId && povUserId === meUserId;
  const iAmHoh = isFrookies && meUserId && hohUserId === meUserId;
  const povSaveSubmitted = isFrookies && !!povSavedUserId;
  const activePlayers = players.filter((p) => p.status === "ACTIVE");

  const box: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 10,
    background: "var(--bg-card)",
    maxHeight: 240,
    overflowY: "auto",
    wordBreak: "break-word",
  };

  const systemStory = messages
    .filter((m) => m.isSystem)
    .slice(0, 12)
    .map((m) => ({
      ...m,
      body: m.body.replace(/^\[SYSTEM\]\s*/i, ""),
    }));

  const [povSaving, setPovSaving] = React.useState(false);

  return (
    <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
      {isFrookies && gameId && (gameState === "ROUND_NOMINATE" || gameState === "ROUND_VOTE") && (
        <div style={box}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Competition</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Highest score wins POV. Play the same minigames as Castings.
          </div>
          <Link
            href={`/game/${gameId}/challenge`}
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-btn-send)",
              color: "var(--text-btn-send)",
              fontWeight: 800,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Play competition →
          </Link>
        </div>
      )}

      {isFrookies && gameState === "ROUND_NOMINATE" && iAmPov && onPovSave && (
        <div style={box}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Use POV</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Save yourself or one other player before noms. They cannot be nominated.
          </div>
          {povSaveSubmitted ? (
            <div style={{ fontWeight: 1000, color: "var(--success)" }}>✅ POV save submitted.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                disabled={povSaving}
                onClick={async () => {
                  setPovSaving(true);
                  try {
                    await onPovSave(null);
                    onReload?.();
                  } finally {
                    setPovSaving(false);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  fontWeight: 700,
                  cursor: povSaving ? "not-allowed" : "pointer",
                }}
              >
                Save myself
              </button>
              {activePlayers
                .filter((p) => p.userId !== meUserId)
                .map((p) => (
                  <button
                    key={p.userId}
                    disabled={povSaving}
                    onClick={async () => {
                      setPovSaving(true);
                      try {
                        await onPovSave(p.userId);
                        onReload?.();
                      } finally {
                        setPovSaving(false);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                      fontWeight: 700,
                      cursor: povSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    Save {p.username}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <div style={box}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>
          {gameState === "ROUND_NOMINATE"
            ? frookiesPhase === "HOH_RENOM"
              ? "Pick 1 replacement nominee"
              : isFrookies
                ? "HOH Nominations"
                : "Confirm Nominations"
            : gameState === "ROUND_VOTE"
              ? "Confirm Vote"
              : "Round"}
        </div>

        {gameState === "ROUND_NOMINATE" && (
          <>
            {isFrookies && !iAmHoh && frookiesPhase !== "HOH_RENOM" && (
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Only the HOH can nominate.</div>
            )}
            {frookiesPhase === "POV_SAVE" && (
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>POV may save themselves or one player. Then everyone votes.</div>
            )}
            {myNomLockedIn ? (
              <div style={{ fontWeight: 1000, color: "var(--success)" }}>✅ Nominations locked in.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  Selected: <b>{nomSelected.length}/{frookiesPhase === "HOH_RENOM" ? 1 : 2}</b>
                </div>
                <button
                  disabled={!canConfirmNoms}
                  onClick={onConfirmNoms}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: canConfirmNoms ? "var(--bg-btn-send)" : "var(--bg-btn-disabled)",
                    color: canConfirmNoms ? "var(--text-btn-send)" : "var(--text-primary)",
                    fontWeight: 1000,
                    cursor: canConfirmNoms ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm Nominations
                </button>
              </>
            )}
          </>
        )}

        {gameState === "ROUND_VOTE" && (
          <>
            {myVoteLockedIn ? (
              <div style={{ fontWeight: 1000, color: "var(--success)" }}>✅ Vote locked in.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  Selected evict: <b>{evictSelected ? "1/1" : "0/1"}</b>
                </div>
                <button
                  disabled={!canConfirmVote}
                  onClick={onConfirmVote}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: canConfirmVote ? "var(--bg-btn-send)" : "var(--bg-btn-disabled)",
                    color: canConfirmVote ? "var(--text-btn-send)" : "var(--text-primary)",
                    fontWeight: 1000,
                    cursor: canConfirmVote ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm Vote
                </button>
              </>
            )}
          </>
        )}

        {(gameState !== "ROUND_NOMINATE" && gameState !== "ROUND_VOTE") && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            State: <b>{gameState}</b> · Round <b>{roundNumber}</b>
          </div>
        )}
      </div>

      <div style={box}>
        <div style={{ fontWeight: 1000, color: "#b02a37" }}>Read this</div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.35 }}>
          {isFrookies ? (
            <>
              <b>Frookies:</b> Play the competition (highest score = POV). POV can save themselves or one player. HOH nominates 2. Vote to evict.
              <br /><br />
            </>
          ) : (
            <>
              <b>Fasting:</b> POV is awarded first (immune). Pick 2 nominees. Then vote to evict one nominee.
              <br /><br />
            </>
          )}
          <b>State:</b> {gameState} · <b>Round:</b> {roundNumber}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 1000, color: "var(--brand)" }}>Story</div>
        {systemStory.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>No story yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {systemStory.map((m) => (
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
                  <span style={{ fontWeight: 800 }}>System</span>
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
        )}
      </div>
    </div>
  );
}
