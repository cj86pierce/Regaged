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
  lastActiveAt: string;
  eliminatedPlace: number | null;
  isNominee: boolean;
  hasVoted: boolean | null;
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
  game: { id: string; number: number; state: string; roundNumber: number; povUserId: string | null; stateEndsAt: string | null };
  lobby: { current: number; needed: number } | null;
  nominees: { a: string; b: string; evictedUserId: string | null } | null;
  voteInfo: { myVoteTargetUserId: string | null } | null;
  players: Player[];
  messages: Message[];
  pagination: { page: number; pageSize: number; totalPages: number; totalCount: number };
};

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;

  const [data, setData] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"public" | "private">("public");
  const [chatText, setChatText] = useState("");
  const [page, setPage] = useState(1);

  // ✅ selection lives here
  const [nomSelected, setNomSelected] = useState<string[]>([]);
  const [evictSelected, setEvictSelected] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=${page}&pageSize=25`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);

    // Clear selections when phase changes / locks
    if (json.game.state !== "ROUND_NOMINATE") setNomSelected([]);
    if (json.game.state !== "ROUND_VOTE") setEvictSelected(null);
    if (json.myNomLocked) setNomSelected([]);
    if (json.voteInfo?.myVoteTargetUserId) setEvictSelected(null);
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
    if (!res.ok) return setError(json?.error ?? "Chat failed");
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

  async function confirmNoms() {
    if (nomSelected.length !== 2) return;
    setError(null);
    const res = await fetch(`/api/game/${gameId}/nominations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: nomSelected }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json?.error ?? "Nomination failed");
    await load();
  }

  async function confirmVote() {
    if (!evictSelected) return;
    setError(null);
    const res = await fetch(`/api/game/${gameId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: evictSelected }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json?.error ?? "Vote failed");
    await load();
  }

  if (!data) return <p style={{ padding: 16 }}>Loading game…</p>;

  const myNomLockedIn = data.myNomLocked === true;
  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Fasting <span style={{ opacity: 0.6, fontWeight: 900 }}>· Game #{data.game.number}</span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {data.game.state === "ENROLLING" && data.lobby ? (
            <>
              Filling: <b>{data.lobby.current}/15</b> ({data.lobby.needed} needed)
            </>
          ) : (
            <>
              Round <b>{data.game.roundNumber}</b> · State <b>{data.game.state}</b>
              {timeLeft !== null && (
                <>
                  {" "}
                  · Ends in <b>{timeLeft}s</b>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <PlayerStrip
        players={data.players}
        povUserId={data.game.povUserId}
        gameState={data.game.state}
        meUserId={data.meUserId}
        myNomLockedIn={myNomLockedIn}
        onSubmitNoms={async () => {}}
        myVoteLockedIn={myVoteLockedIn}
        onEvict={async () => {}}
        nomSelected={nomSelected}
        setNomSelected={setNomSelected}
        evictSelected={evictSelected}
        setEvictSelected={setEvictSelected}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14, marginTop: 10 }}>
        <div>
          <Tabs tab={tab} setTab={setTab} publicCount={data.pagination.totalCount} />

          {tab === "public" && (
            <ChatPanel
              meUserId={data.meUserId}
              messages={data.messages}
              chatText={chatText}
              setChatText={setChatText}
              onSend={sendChat}
              onReact={react}
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              setPage={setPage}
            />
          )}

          {error && (
            <div style={{ marginTop: 10, color: "crimson" }}>
              <b>{error}</b>
            </div>
          )}
        </div>

        <Sidebar
          gameState={data.game.state}
          roundNumber={data.game.roundNumber}
          nomSelected={nomSelected}
          canConfirmNoms={data.game.state === "ROUND_NOMINATE" && !myNomLockedIn && nomSelected.length === 2}
          onConfirmNoms={confirmNoms}
          myNomLockedIn={myNomLockedIn}
          evictSelected={evictSelected}
          canConfirmVote={data.game.state === "ROUND_VOTE" && !myVoteLockedIn && !!evictSelected}
          onConfirmVote={confirmVote}
          myVoteLockedIn={myVoteLockedIn}
        />
      </div>
    </div>
  );
}
