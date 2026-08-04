"use client";

import React from "react";
import Link from "next/link";
import RookiesVoteBox from "./RookiesVoteBox";

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
  myRankingsLocked?: boolean;

  messages?: Msg[];

  // Frookies: competition + POV save + HOH-only noms
  gameId?: string;
  gameType?: string;
  meUserId?: string | null;
  povUserId?: string | null;
  hohUserId?: string | null;
  povSavedUserId?: string | null;
  frookiesPhase?: string | null;
  players?: { userId: string; username: string; status: string; isNominee?: boolean }[];
  rookiesNominees?: { userId: string; username: string }[];
  onPovSave?: (targetUserId: string | null) => Promise<void>;
  onReload?: () => void;

  // Frookies: jury phase (final 2)
  jury?: {
    finalists: { userId: string; username: string }[];
    isJuror: boolean;
    myVoteTargetUserId: string | null;
    voteCount: number;
    jurorCount: number;
  } | null;
  onJuryVote?: (targetUserId: string) => Promise<void>;
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
    myRankingsLocked,
    messages = [],
    gameId,
    gameType,
    meUserId,
    povUserId,
    hohUserId,
    povSavedUserId,
    frookiesPhase,
    players = [],
    rookiesNominees = [],
    onPovSave,
    onReload,
    jury,
    onJuryVote,
  } = props;

  const isFrookies = gameType === "FROOKIES" || gameType === "FROOKIES_BOT";
  const isRookies = gameType === "ROOKIES" || gameType === "ROOKIES_BOT";
  const iAmPov = !!(meUserId && povUserId === meUserId);
  const iAmHoh = !!(meUserId && hohUserId === meUserId);
  const povSaveSubmitted = !!povSavedUserId;
  const activePlayers = players.filter((p) => p.status === "ACTIVE");
  const rookiesNomineeList =
    rookiesNominees.length > 0
      ? rookiesNominees
      : players.filter((p) => p.isNominee).map((p) => ({ userId: p.userId, username: p.username }));

  const box: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 4,
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
  const [juryVoting, setJuryVoting] = React.useState(false);

  return (
    <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
      {isFrookies && gameState === "JURY_VOTE" && jury && (
        <div style={box}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Jury Vote</div>
          <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.85 }}>
            {jury.voteCount}/{jury.jurorCount} jurors have voted.
          </div>
          {!jury.isJuror ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Only players evicted 9th through 3rd place can vote. Sit tight for the result.
            </div>
          ) : jury.myVoteTargetUserId ? (
            <div style={{ fontWeight: 1000, color: "var(--success)" }}>
              ✅ Vote submitted for{" "}
              {jury.finalists.find((f) => f.userId === jury.myVoteTargetUserId)?.username ?? "your pick"}.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {jury.finalists.map((f) => (
                <button
                  key={f.userId}
                  disabled={juryVoting}
                  onClick={async () => {
                    if (!onJuryVote) return;
                    setJuryVoting(true);
                    try {
                      await onJuryVote(f.userId);
                    } finally {
                      setJuryVoting(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-btn-send)",
                    color: "var(--text-btn-send)",
                    fontWeight: 1000,
                    cursor: juryVoting ? "not-allowed" : "pointer",
                  }}
                >
                  Vote for {f.username}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isFrookies && gameId && (gameState === "ROUND_NOMINATE" || gameState === "ROUND_VOTE") && (
        <div style={box}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Competition</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Highest challenge score wins POV. Retries keep your best.
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

      {isRookies && gameState === "ROUND_VOTE" && iAmPov && onPovSave && (
        <div style={box}>
          <div style={{ fontWeight: 1000, marginBottom: 6 }}>Secret POV</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Only you know you have POV. Save one nominee so they cannot be evicted.
          </div>
          {povSaveSubmitted ? (
            <div style={{ fontWeight: 1000, color: "var(--success)" }}>✅ POV save submitted.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rookiesNomineeList.map((n) => (
                <button
                  key={n.userId}
                  disabled={povSaving}
                  onClick={async () => {
                    setPovSaving(true);
                    try {
                      await onPovSave(n.userId);
                      onReload?.();
                    } finally {
                      setPovSaving(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-btn-send)",
                    color: "var(--text-btn-send)",
                    fontWeight: 1000,
                    cursor: povSaving ? "not-allowed" : "pointer",
                  }}
                >
                  Save {n.username}
                </button>
              ))}
            </div>
          )}
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
            {(isFrookies || isRookies) && !iAmHoh && frookiesPhase !== "HOH_RENOM" && (
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

        {gameState === "ROUND_VOTE" && isRookies && gameId && rookiesNomineeList.length >= 3 ? (
          <RookiesVoteBox
            gameId={gameId}
            nominees={rookiesNomineeList}
            locked={!!myRankingsLocked}
            onSaved={async () => { onReload?.(); }}
          />
        ) : gameState === "ROUND_VOTE" ? (
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
        ) : null}

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
              <b>Frookies:</b> Play the competition (highest score = POV, costs health to win). POV can save themselves or one player. HOH nominates 2. Vote to evict. At final 2, the jury (9th–3rd place) votes for the winner.
              <br /><br />
            </>
          ) : isRookies ? (
            <>
              <b>Rookies:</b> HOH nominates 2; algorithm adds more (4 total, 3 at final 5). Rank nominees with points — top 2 are evicted. POV is secret. Top 3 place by activity.
              <br /><br />
            </>
          ) : (
            <>
              <b>Fasting:</b> POV is awarded first (immune). Pick 2 nominees. Then vote to evict one nominee. Final 3 starts a 12-hour clock before placements.
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
