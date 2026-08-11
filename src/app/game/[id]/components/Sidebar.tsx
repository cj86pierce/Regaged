"use client";

import React from "react";
import Link from "next/link";
import RookiesVoteBox from "./RookiesVoteBox";
import "@/styles/tengagedChat.css";

type Msg = { id: string; body: string; createdAt: string; isSystem: boolean };

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function storyText(body: string): string | null {
  const raw = body.trim();
  if (/^\[CASTDROP:/i.test(raw) || /^\[DROP:/i.test(raw)) return null;
  return (
    raw
      .replace(/^\[SYSTEM\]\s*/i, "")
      .replace(/^\[SYSTEM:[^\]]+\]\n?/i, "")
      .replace(/^\[SYSMSG:[^\]]+\]\s*/i, "")
      .trim() || null
  );
}

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

  gameId?: string;
  gameType?: string;
  survivorPhase?: string | null;
  meUserId?: string | null;
  povUserId?: string | null;
  hohUserId?: string | null;
  povSavedUserId?: string | null;
  frookiesPhase?: string | null;
  players?: { userId: string; username: string; status: string; isNominee?: boolean }[];
  rookiesNominees?: { userId: string; username: string }[];
  onPovSave?: (targetUserId: string | null) => Promise<void>;
  onReload?: () => void;

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
    survivorPhase,
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
  const isSurvivor = gameType === "SURVIVOR" || gameType === "SURVIVOR_BOT";
  const iAmPov = !!(meUserId && povUserId === meUserId);
  const iAmHoh = !!(meUserId && hohUserId === meUserId);
  const povSaveSubmitted = !!povSavedUserId;
  const activePlayers = players.filter((p) => p.status === "ACTIVE");
  const rookiesNomineeList =
    rookiesNominees.length > 0
      ? rookiesNominees
      : players.filter((p) => p.isNominee).map((p) => ({ userId: p.userId, username: p.username }));

  const [povSaving, setPovSaving] = React.useState(false);
  const [juryVoting, setJuryVoting] = React.useState(false);

  const statusNote = (() => {
    if (isSurvivor) return (survivorPhase ?? gameState).replace(/_/g, " ");
    if (gameState === "ROUND_NOMINATE") {
      if (frookiesPhase === "HOH_RENOM") return "HOH picks a replacement nominee";
      if (frookiesPhase === "POV_SAVE") return "POV may save before noms";
      return isFrookies || isRookies ? "HOH nominations" : "Pick nominees";
    }
    if (gameState === "ROUND_VOTE") return isRookies ? "Rank the nominees" : "Vote to evict";
    if (gameState === "JURY_VOTE") return "Jury is voting";
    return gameState.replace(/_/g, " ");
  })();

  const rulesTitle = isSurvivor
    ? "How Survivor works"
    : isFrookies
      ? "How Frookies works"
      : isRookies
        ? "How Rookies works"
        : "How Fasting works";

  const story = messages
    .filter((m) => m.isSystem)
    .map((m) => {
      const text = storyText(m.body);
      if (!text) return null;
      return { id: m.id, text, when: ago(m.createdAt) };
    })
    .filter(Boolean)
    .slice(0, 8) as { id: string; text: string; when: string }[];

  return (
    <aside className="tgSide">
      <div className="tgSideStatus">
        <div className="tgSideStatusTitle">
          {isSurvivor ? "Survivor" : "Round"} {roundNumber}
        </div>
        <div className="tgSideStatusNote">{statusNote}</div>
      </div>

      {isFrookies && gameState === "JURY_VOTE" && jury && (
        <div className="tgAction">
          <div className="tgActionHead">Jury vote</div>
          <div className="tgActionHint">
            {jury.voteCount}/{jury.jurorCount} jurors have voted.
          </div>
          {!jury.isJuror ? (
            <div className="tgActionHint">Only 9th–3rd place can vote. Sit tight.</div>
          ) : jury.myVoteTargetUserId ? (
            <div className="tgActionOk">
              Vote in for {jury.finalists.find((f) => f.userId === jury.myVoteTargetUserId)?.username ?? "your pick"}.
            </div>
          ) : (
            <div className="tgActionStack">
              {jury.finalists.map((f) => (
                <button
                  key={f.userId}
                  type="button"
                  className="tgActionBtn"
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
                >
                  Vote for {f.username}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isFrookies && gameId && (gameState === "ROUND_NOMINATE" || gameState === "ROUND_VOTE") && (
        <div className="tgAction">
          <div className="tgActionHead">Competition</div>
          <div className="tgActionHint">Highest score wins POV. Retries keep your best.</div>
          <Link href={`/game/${gameId}/challenge`} className="tgActionBtn link">
            Play competition →
          </Link>
        </div>
      )}

      {isRookies && gameState === "ROUND_VOTE" && iAmPov && onPovSave && (
        <div className="tgAction">
          <div className="tgActionHead">Secret POV</div>
          <div className="tgActionHint">Save one nominee so they cannot be evicted.</div>
          {povSaveSubmitted ? (
            <div className="tgActionOk">POV save submitted.</div>
          ) : (
            <div className="tgActionStack">
              {rookiesNomineeList.map((n) => (
                <button
                  key={n.userId}
                  type="button"
                  className="tgActionBtn"
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
                >
                  Save {n.username}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isFrookies && gameState === "ROUND_NOMINATE" && iAmPov && onPovSave && (
        <div className="tgAction">
          <div className="tgActionHead">Use POV</div>
          <div className="tgActionHint">Save yourself or one other player before noms.</div>
          {povSaveSubmitted ? (
            <div className="tgActionOk">POV save submitted.</div>
          ) : (
            <div className="tgActionStack">
              <button
                type="button"
                className="tgActionBtn secondary"
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
              >
                Save myself
              </button>
              {activePlayers
                .filter((p) => p.userId !== meUserId)
                .map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    className="tgActionBtn secondary"
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
                  >
                    Save {p.username}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {!isSurvivor && (
        <div className="tgAction">
          <div className="tgActionHead">
            {gameState === "ROUND_NOMINATE"
              ? frookiesPhase === "HOH_RENOM"
                ? "Replacement nominee"
                : isFrookies
                  ? "HOH nominations"
                  : "Nominations"
              : gameState === "ROUND_VOTE"
                ? isRookies
                  ? "Ranking vote"
                  : "Eviction vote"
                : "Actions"}
          </div>

          {gameState === "ROUND_NOMINATE" && (
            <>
              {(isFrookies || isRookies) && !iAmHoh && frookiesPhase !== "HOH_RENOM" && (
                <div className="tgActionHint">Only the HOH can nominate.</div>
              )}
              {frookiesPhase === "POV_SAVE" && (
                <div className="tgActionHint">POV may save first. Then everyone votes.</div>
              )}
              {myNomLockedIn ? (
                <div className="tgActionOk">Nominations locked in.</div>
              ) : (
                <>
                  <div className="tgActionHint">
                    Selected: <b>{nomSelected.length}/{frookiesPhase === "HOH_RENOM" ? 1 : 2}</b>
                  </div>
                  <button
                    type="button"
                    className="tgActionBtn"
                    disabled={!canConfirmNoms}
                    onClick={onConfirmNoms}
                  >
                    Confirm nominations
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
              onSaved={async () => {
                onReload?.();
              }}
              tengaged
            />
          ) : gameState === "ROUND_VOTE" ? (
            <>
              {myVoteLockedIn ? (
                <div className="tgActionOk">Vote locked in.</div>
              ) : (
                <>
                  <div className="tgActionHint">
                    Selected evict: <b>{evictSelected ? "1/1" : "0/1"}</b>
                  </div>
                  <button
                    type="button"
                    className="tgActionBtn"
                    disabled={!canConfirmVote}
                    onClick={onConfirmVote}
                  >
                    Confirm vote
                  </button>
                </>
              )}
            </>
          ) : null}

          {gameState !== "ROUND_NOMINATE" && gameState !== "ROUND_VOTE" && (
            <div className="tgActionHint">
              {gameState.replace(/_/g, " ")} · Round {roundNumber}
            </div>
          )}
        </div>
      )}

      <details className="tgSideDetails">
        <summary>{rulesTitle}</summary>
        <ul>
          {isSurvivor ? (
            <>
              <li>Two tribe lobbies. Manage camp and play competitions.</li>
              <li>Highest tribe total wins immunity; top scorer on the losing tribe is also immune.</li>
              <li>Places are 1st (merge) or 20th (out). At 10 left, 1sts go to a merge lobby.</li>
            </>
          ) : isFrookies ? (
            <>
              <li>Competition: highest score gets POV (costs health).</li>
              <li>POV can save themselves or one player; HOH nominates 2.</li>
              <li>Vote to evict. At final 2, jury (9th–3rd) picks the winner.</li>
            </>
          ) : isRookies ? (
            <>
              <li>HOH nominates 2; algorithm fills to 4 (3 at final 5).</li>
              <li>Rank nominees with points — top 2 are evicted. POV is secret.</li>
              <li>Top 3 place by activity.</li>
            </>
          ) : (
            <>
              <li>POV is awarded first (immune). Pick 2 nominees.</li>
              <li>Vote to evict one nominee.</li>
              <li>Final 3 starts a 30-minute clock before placements.</li>
            </>
          )}
        </ul>
      </details>

      <div className="tgSideStory">
        <div className="tgSideStoryHead">Game story</div>
        {story.length === 0 ? (
          <div className="tgSideStoryEmpty">No story yet.</div>
        ) : (
          <ul>
            {story.map((s) => (
              <li key={s.id}>
                <span className="when">{s.when}</span>
                <span className="text">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
