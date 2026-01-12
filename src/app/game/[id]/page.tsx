"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerStrip from "./components/PlayerStrip";
import ChatPanel from "./components/ChatPanel";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  chatCount: number;
  plusCount: number;
  minusCount: number;
  povWins: number;
};

type Message = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  plus: number;
  minus: number;
  myReaction: "PLUS" | "MINUS" | null;
  isSystem: boolean;
};

type GameState = {
  ok: boolean;
  meUserId: string | null;
  myNomLocked: boolean | null;
  game: {
    id: string;
    state: string;
    roundNumber: number;
    povUserId: string | null;
    stateEndsAt: string | null;
  };
  nominees: { a: string; b: string; evictedUserId: string | null } | null;
  voteInfo: {
    nomineeAUserId: string;
    nomineeBUserId: string;
    votesA: number;
    votesB: number;
    myVoteTargetUserId: string | null;
  } | null;
  players: Player[];
  messages: Message[];
  pagination: { page: number; pageSize: number; totalPages: number; totalCount: number };
};

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;

  const [data, setData] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"public" | "private">("public");
  const [nomPicks, setNomPicks] = useState<string[]>([]);
  const [votePick, setVotePick] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");

  const [page, setPage] = useState(1);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=${page}&pageSize=25`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const poll = setInterval(() => load().catch(() => {}), 3500);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, page]);

  const timeLeft = useMemo(() => {
    if (!data?.game.stateEndsAt) return null;
    const ms = new Date(data.game.stateEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data]);

  async function sendChat() {
    setError(null);
    const res = await fetch(`/api/game/${gameId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: chatText }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Chat failed");
      return;
    }
    setChatText("");
    setPage(1);
    await load();
  }

  async function react(messageId: string, type: "PLUS" | "MINUS") {
    setError(null);
    const res = await fetch(`/api/game/message/${messageId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json();
    if (!res.ok) setError(json?.error ?? "Reaction failed");
    else await load();
  }

  function toggleNom(userId: string) {
    setNomPicks((prev) => {
      if (prev.includes(userId)) return prev.filter((x) => x !== userId);
      if (prev.length >= 2) return prev;
      return [...prev, userId];
    });
  }

  async function submitNoms() {
    setError(null);
    const res = await fetch(`/api/game/${gameId}/nominations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: nomPicks }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Nomination failed");
      return;
    }
    setNomPicks([]);
    await load();
  }

  async function submitVote() {
    if (!votePick) return;
    setError(null);
    const res = await fetch(`/api/game/${gameId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: votePick }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Vote failed");
      return;
    }
    await load();
  }

  if (!data) return <p style={{ padding: 16 }}>Loading game…</p>;

  const nomineeA = data.nominees?.a ?? null;
  const nomineeB = data.nominees?.b ?? null;

  const nomineePlayers =
    nomineeA && nomineeB ? data.players.filter((p) => p.userId === nomineeA || p.userId === nomineeB) : [];

  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;
  const myNomLockedIn = data.myNomLocked === true;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Fasting</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Round <b>{data.game.roundNumber}</b> · State <b>{data.game.state}</b>
          {timeLeft !== null && (
            <>
              {" "}
              · Ends in <b>{timeLeft}s</b>
            </>
          )}
        </div>
      </div>

      <PlayerStrip players={data.players} povUserId={data.game.povUserId} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14, marginTop: 10 }}>
        <div>
          <Tabs tab={tab} setTab={setTab} publicCount={data.pagination.totalCount} />

          {tab === "public" && (
            <ChatPanel
              gameId={gameId}
              meUserId={data.meUserId}
              messages={data.messages}
              chatText={chatText}
              setChatText={setChatText}
              onSend={sendChat}
              onReact={react}
              gameState={data.game.state}
              povUserId={data.game.povUserId}
              players={data.players}
              myNomLockedIn={myNomLockedIn}
              nomPicks={nomPicks}
              toggleNom={toggleNom}
              submitNoms={submitNoms}
              nominees={data.nominees}
              nomineePlayers={nomineePlayers}
              voteInfo={data.voteInfo}
              myVoteLockedIn={myVoteLockedIn}
              votePick={votePick}
              setVotePick={setVotePick}
              submitVote={submitVote}
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              setPage={setPage}
            />
          )}

          {tab === "private" && (
            <div style={{ border: "1px solid #d7d7d7", borderRadius: 10, padding: 12, background: "#fff" }}>
              <b>Private messages</b>
              <div style={{ marginTop: 8, opacity: 0.75 }}>Not implemented yet (public-only first).</div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 10, color: "crimson" }}>
              <b>{error}</b>
            </div>
          )}
        </div>

        <Sidebar
          gameId={gameId}
          gameState={data.game.state}
          roundNumber={data.game.roundNumber}
          messages={data.messages}
          nominees={data.nominees}
          nomineePlayers={nomineePlayers.map((p) => ({ userId: p.userId, username: p.username }))}
          myVoteLockedIn={myVoteLockedIn}
          votePick={votePick}
          setVotePick={setVotePick}
          submitVote={submitVote}
        />
      </div>
    </div>
  );
}
