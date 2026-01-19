"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerStrip from "./components/PlayerStrip"; // FASTING (do not touch)
import CastingPlayerStrip from "./components/CastingPlayerStrip"; // CASTING only
import ChatPanel from "./components/ChatPanel"; // FASTING chat
import CastingChatPanel from "./components/CastingChatPanel"; // CASTING chat
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import PmPanel from "./components/PmPanel";
import type { AvatarConfig } from "@/components/Avatar";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string;
  eliminatedPlace: number | null;
  isNominee: boolean;

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

type DropEventsMap = Record<
  string,
  { eventId: string; claimedAt: string | null; options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[] }
>;

type GameState = {
  ok: boolean;
  meUserId: string | null;
  myNomLocked: boolean | null;
  game: {
    id: string;
    number: number;
    gameType: string;
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

  // CASTING-only helper
  dropEvents?: DropEventsMap;
};

function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id;

  const [data, setData] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"public" | "private">("public");
  const [chatText, setChatText] = useState("");
  const [page, setPage] = useState(1);

  const [nomSelected, setNomSelected] = useState<string[]>([]);
  const [evictSelected, setEvictSelected] = useState<string | null>(null);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
  if (!data || data.game.gameType !== "CASTING") return;

  const t = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/cron/tick", { method: "POST" }).catch(() => {});
  }, 60000);

  return () => clearInterval(t);
}, [data?.game.gameType]);


  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=${page}&pageSize=25`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);

    // FASTING-only selection cleanup
    if (json.game.gameType === "FASTING") {
      if (json.game.state !== "ROUND_NOMINATE") setNomSelected([]);
      if (json.game.state !== "ROUND_VOTE") setEvictSelected(null);
      if (json.myNomLocked) setNomSelected([]);
      if (json.voteInfo?.myVoteTargetUserId) setEvictSelected(null);
    } else {
      setNomSelected([]);
      setEvictSelected(null);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const poll = setInterval(() => load().catch(() => {}), 12000);
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

  const isCasting = data.game.gameType === "CASTING";
  const maxPlayers = isCasting ? 20 : 15;

  const myNomLockedIn = data.myNomLocked === true;
  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;

  const meStats = data.meUserId ? data.players.find((p) => p.userId === data.meUserId) ?? null : null;

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
                  · Ends in <b>{fmtHMS(timeLeft)}</b>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isCasting ? (
        <CastingPlayerStrip
          players={data.players}
          me={meStats ? { checks: meStats.checks, health: meStats.health, keys: meStats.keys } : null}
        />
      ) : (
        <PlayerStrip
          players={data.players}
          povUserId={data.game.povUserId}
          gameState={data.game.state}
          meUserId={data.meUserId}
          myNomLockedIn={myNomLockedIn}
          myVoteLockedIn={myVoteLockedIn}
          nomSelected={nomSelected}
          setNomSelected={setNomSelected}
          evictSelected={evictSelected}
          setEvictSelected={setEvictSelected}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14, marginTop: 10 }}>
        <div>
          <Tabs tab={tab} setTab={setTab} publicCount={data.pagination.totalCount} />

          {tab === "public" &&
            (isCasting ? (
              <CastingChatPanel
                gameId={gameId}
                meUserId={data.meUserId}
                messages={data.messages}
                dropEvents={data.dropEvents ?? {}}
                chatText={chatText}
                setChatText={setChatText}
                onSend={sendChat}
                onReact={react}
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                setPage={setPage}
                onReload={load}
              />
            ) : (
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
            ))}

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

        <Sidebar
          gameState={data.game.state}
          roundNumber={data.game.roundNumber}
          nomSelected={nomSelected}
          canConfirmNoms={!isCasting && data.game.state === "ROUND_NOMINATE" && !myNomLockedIn && nomSelected.length === 2}
          onConfirmNoms={confirmNoms}
          myNomLockedIn={myNomLockedIn}
          evictSelected={evictSelected}
          canConfirmVote={!isCasting && data.game.state === "ROUND_VOTE" && !myVoteLockedIn && !!evictSelected}
          onConfirmVote={confirmVote}
          myVoteLockedIn={myVoteLockedIn}
          messages={data.messages}
        />
      </div>
    </div>
  )}
  
