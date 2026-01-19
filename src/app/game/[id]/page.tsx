"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerStrip from "./components/PlayerStrip";
import ChatPanel from "./components/ChatPanel";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import PmPanel from "./components/PmPanel";
import CastingsPanel from "./components/CastingsPanel";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string;
  eliminatedPlace: number | null;
  isNominee: boolean;

  // ✅ casting stats from API
  checks: number;
  health: number;
  keys: number;

  avatar: AvatarConfig;
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
    number: number;
    gameType: "FASTING" | "CASTING" | string;
    state: string;
    roundNumber: number;
    povUserId: string | null;
    stateEndsAt: string | null;
  };
  lobby: { current: number; needed: number } | null;
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

  const [nomSelected, setNomSelected] = useState<string[]>([]);
  const [evictSelected, setEvictSelected] = useState<string | null>(null);

  // smoother timer
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=${page}&pageSize=25`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);

    // clear fasting-only selection state when not applicable
    if (json.game.gameType !== "FASTING") {
      setNomSelected([]);
      setEvictSelected(null);
      return;
    }

    if (json.game.state !== "ROUND_NOMINATE") setNomSelected([]);
    if (json.game.state !== "ROUND_VOTE") setEvictSelected(null);
    if (json.myNomLocked) setNomSelected([]);
    if (json.voteInfo?.myVoteTargetUserId) setEvictSelected(null);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const poll = setInterval(() => load().catch(() => {}), 12000); // ✅ slower polling for stability
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, page]);

  const timeLeft = useMemo(() => {
    if (!data?.game.stateEndsAt) return null;
    const end = new Date(data.game.stateEndsAt).getTime();
    const ms = end - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [data?.game.stateEndsAt, now]);

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

  const isFasting = data.game.gameType === "FASTING";
  const isCasting = data.game.gameType === "CASTING";
  const maxPlayers = isCasting ? 20 : 15;

  const myNomLockedIn = data.myNomLocked === true;
  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {data.game.gameType} <span style={{ opacity: 0.6, fontWeight: 900 }}>· Game #{data.game.number}</span>
        </div>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {data.game.state === "ENROLLING" && data.lobby ? (
            <>
              Filling: <b>{data.lobby.current}/{maxPlayers}</b> ({data.lobby.needed} needed)
            </>
          ) : (
            <>
              Day/Round <b>{data.game.roundNumber}</b> · State <b>{data.game.state}</b>
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
        players={data.players as any}
        povUserId={isFasting ? data.game.povUserId : null}
        gameState={data.game.state}
        gameType={data.game.gameType}
        meUserId={data.meUserId}
        myNomLockedIn={isFasting ? myNomLockedIn : true}
        myVoteLockedIn={isFasting ? myVoteLockedIn : null}
        nomSelected={isFasting ? nomSelected : []}
        setNomSelected={isFasting ? setNomSelected : () => {}}
        evictSelected={isFasting ? evictSelected : null}
        setEvictSelected={isFasting ? setEvictSelected : () => {}}
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

          {tab === "private" && (
            <PmPanel
              gameId={gameId}
              meUserId={data.meUserId}
              players={data.players.map((p) => ({ userId: p.userId, username: p.username, status: p.status }))}
            />
          )}

          {error && (
            <div style={{ marginTop: 10, color: "crimson" }}>
              <b>{error}</b>
            </div>
          )}
        </div>

        {isCasting ? (
          <CastingsPanel
            meUserId={data.meUserId}
            gameNumber={data.game.number}
            dayNumber={data.game.roundNumber}
            timeLeft={timeLeft}
            players={data.players.map((p) => ({
              userId: p.userId,
              username: p.username,
              checks: p.checks,
              health: p.health,
              keys: p.keys,
            }))}
          />
        ) : (
          <Sidebar
            gameState={data.game.state}
            roundNumber={data.game.roundNumber}
            nomSelected={nomSelected}
            canConfirmNoms={isFasting && data.game.state === "ROUND_NOMINATE" && !myNomLockedIn && nomSelected.length === 2}
            onConfirmNoms={confirmNoms}
            myNomLockedIn={myNomLockedIn}
            evictSelected={evictSelected}
            canConfirmVote={isFasting && data.game.state === "ROUND_VOTE" && !myVoteLockedIn && !!evictSelected}
            onConfirmVote={confirmVote}
            myVoteLockedIn={myVoteLockedIn}
            messages={data.messages}
          />
        )}
      </div>
    </div>
  );
}
