"use client";

import { useMemo } from "react";
import CastingVoteBox from "./CastingVoteBox";
import CarePackagePanel from "./CarePackagePanel";
import "@/styles/tengagedChat.css";

type Message = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  username: string;
};

function storyLine(body: string): string | null {
  const raw = body.trim();
  if (/^\[CASTDROP:/i.test(raw) || /^\[DROP:/i.test(raw)) return null; // drops live in chat / care panel
  return (
    raw
      .replace(/^\[SYSTEM\]\s*/i, "")
      .replace(/^\[SYSTEM:[^\]]+\]\n?/i, "")
      .replace(/^\[SYSMSG:[^\]]+\]\s*/i, "")
      .trim() || null
  );
}

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

export default function CastingSidebar(props: {
  gameId: string;
  state: string;
  dayNumber: number;

  nominees: { userId: string; username: string }[];
  myPointsMap?: Record<string, number> | null;
  onSavedVotes: () => Promise<void>;

  messages: Message[];
  carePackages?: Array<{
    eventId: string;
    claimedAt: string | null;
    options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[];
  }>;
  onReload?: () => Promise<void>;
  meUserId?: string | null;
}) {
  const showVote = props.state === "ROUND_VOTE" && props.nominees.length >= 2;

  const status = useMemo(() => {
    if (props.dayNumber <= 1 && props.state === "ROUND_NOMINATE") {
      return { title: `Day ${props.dayNumber}`, note: "Settle in — compete & grab keys. No noms today." };
    }
    if (props.state === "ROUND_VOTE") {
      return { title: `Day ${props.dayNumber}`, note: "Nominees are up — assign 1 / 2 / 3." };
    }
    if (props.state === "ROUND_COMPETE" || props.state === "ROUND_MINIGAME") {
      return { title: `Day ${props.dayNumber}`, note: "Competition open — earn keys & checks." };
    }
    return { title: `Day ${props.dayNumber}`, note: props.state.replace(/_/g, " ") };
  }, [props.dayNumber, props.state]);

  const story = useMemo(() => {
    const out: { id: string; text: string; when: string }[] = [];
    for (const m of props.messages) {
      if (!m.isSystem) continue;
      const text = storyLine(m.body);
      if (!text) continue;
      out.push({ id: m.id, text, when: ago(m.createdAt) });
      if (out.length >= 8) break;
    }
    return out;
  }, [props.messages]);

  return (
    <aside className="tgSide">
      <div className="tgSideStatus">
        <div className="tgSideStatusTitle">{status.title}</div>
        <div className="tgSideStatusNote">{status.note}</div>
      </div>

      {props.carePackages && props.carePackages.length > 0 && props.onReload ? (
        <CarePackagePanel
          gameId={props.gameId}
          carePackages={props.carePackages}
          onClaimed={props.onReload}
          meUserId={props.meUserId ?? null}
          tengaged
        />
      ) : null}

      {showVote ? (
        <CastingVoteBox
          gameId={props.gameId}
          nominees={props.nominees}
          initialPointsMap={props.myPointsMap}
          onSaved={props.onSavedVotes}
          tengaged
        />
      ) : null}

      <details className="tgSideDetails">
        <summary>How Castings works</summary>
        <ul>
          <li>12-hour days. Day 1 is compete-only; noms start Day 2.</li>
          <li>Lowest challenge score, then lowest checks, get nominated.</li>
          <li>Keys win (max 5). Final 5: keys → challenge → checks.</li>
          <li>Public drops hourly; ≥3 keys/day guaranteed.</li>
          <li>Every 3000 checks → private care package.</li>
          <li>Final 7: only 2 nominees.</li>
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
