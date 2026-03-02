"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerStrip from "./components/PlayerStrip";
import CastingPlayerStrip from "./components/CastingPlayerStrip";
import ChatPanel from "./components/ChatPanel";
import CastingChatPanel from "./components/CastingChatPanel";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import PmPanel from "./components/PmPanel";
import CastingVoteBox from "./components/CastingVoteBox";
import type { AvatarConfig } from "@/components/Avatar";
import CastingSidebar from "./components/CastingSidebar";

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

type DropEventsMap = Record<string, any>;

type GameState = {
  ok: boolean;
  meUserId: string | null;
  myNomLocked: boolean | null;
  game: { id: string; number: number; gameType: string; state: string; roundNumber: number; povUserId: string | null; stateEndsAt: string | null };
  lobby: { current: number; needed: number } | null;
  voteInfo: { myVoteTargetUserId: string | null } | null;
  players: Player[];
  messages: Message[];
  pagination: { page: number; pageSize: number; totalPages: number; totalCount: number };
  dropEvents?: DropEventsMap;
  casting?: { nominees: string[]; myVoted: boolean };
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

  const [sending, setSending] = useState(false);
  const [reactingIds, setReactingIds] = useState<Record<string, boolean>>({});

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const res = await fetch(`/api/game/${gameId}/state?page=${page}&pageSize=25`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);

    if (json.game.gameType === "FASTING" || json.game.gameType === "FASTING_BOT") {
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

  // When timer hits 0, nudge the server to advance (Casting/Fasting/bot modes)
  useEffect(() => {
    if (!data?.game || timeLeft !== 0) return;
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    fetch(`/api/game/${gameId}/nudge`)
      .then(() => {
        if (cancelled) return;
        load().catch(() => {});
        refetchTimer = setTimeout(() => {
          if (!cancelled) load().catch(() => {});
          refetchTimer = undefined;
        }, 1500);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (refetchTimer) clearTimeout(refetchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, data?.game?.gameType, data?.game?.stateEndsAt, timeLeft]);

  async function sendChat() {
    if (sending) return;
    setError(null);

    const text = chatText;
    if (!text.trim()) return;

    setSending(true);

    // optimistic insert
    const tempId = `temp_${Date.now()}`;
    setData((prev) => {
      if (!prev) return prev;
      const optimistic: Message = {
        id: tempId,
        userId: prev.meUserId ?? "me",
        username: "you",
        body: text,
        createdAt: new Date().toISOString(),
        plus: 0,
        minus: 0,
        myReaction: null,
        isSystem: false,
      };
      return { ...prev, messages: [optimistic, ...prev.messages] };
    });

    const res = await fetch(`/api/game/${gameId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const json = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(json?.error ?? "Chat failed");
      // remove optimistic temp
      setData((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev));
      return;
    }

    setChatText("");
    setPage(1);

    // replace temp message with real message
    setData((prev) => {
      if (!prev) return prev;
      const real = json.message as Message;
      const msgs = prev.messages.map((m) => (m.id === tempId ? real : m));
      return { ...prev, messages: msgs };
    });
  }

  async function react(messageId: string, type: "PLUS" | "MINUS") {
    if (reactingIds[messageId]) return;
    setError(null);
    setReactingIds((p) => ({ ...p, [messageId]: true }));

    // optimistic local update
    setData((prev) => {
      if (!prev) return prev;
      const msgs = prev.messages.map((m) => {
        if (m.id !== messageId) return m;
        if (m.myReaction) return m;
        const plus = m.plus + (type === "PLUS" ? 1 : 0);
        const minus = m.minus + (type === "MINUS" ? 1 : 0);
        return { ...m, plus, minus, myReaction: type };
      });
      return { ...prev, messages: msgs };
    });

    const res = await fetch(`/api/game/message/${messageId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });

    const json = await res.json().catch(() => ({}));
    setReactingIds((p) => ({ ...p, [messageId]: false }));

    if (!res.ok) {
      setError(json?.error ?? "Reaction failed");
      // revert by reload on next poll; keep it simple
      return;
    }

    // apply authoritative counts from server
    setData((prev) => {
      if (!prev) return prev;
      const msgs = prev.messages.map((m) => {
        if (m.id !== messageId) return m;
        return { ...m, plus: json.plus ?? m.plus, minus: json.minus ?? m.minus, myReaction: json.myReaction ?? m.myReaction };
      });
      return { ...prev, messages: msgs };
    });
  }

  async function confirmNoms() {
    if (nomSelected.length !== 2) return;
    setError(null);
    const res = await fetch(`/api/game/${gameId}/nominations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: nomSelected }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Nomination failed");
      return;
    }
    setNomSelected([]);
    load().catch((e) => setError(e.message));
  }

  async function confirmVote() {
    if (!evictSelected) return;
    setError(null);
    const res = await fetch(`/api/game/${gameId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: evictSelected }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Vote failed");
      return;
    }
    setEvictSelected(null);
    load().catch((e) => setError(e.message));
  }

  if (!data) return <p style={{ padding: 16 }}>Loading game…</p>;

  const isCasting =
    data.game.gameType === "CASTING" || data.game.gameType === "CASTING_BOT";
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
          ) : data.game.state === "COMPLETED" ? (
            <>
              Game ended · Final placements below
            </>
          ) : (
            <>
              Day/Round <b>{data.game.roundNumber}</b> · State <b>{data.game.state}</b>
              {timeLeft !== null && <> · Ends in <b>{fmtHMS(timeLeft)}</b></>}
            </>
          )}
        </div>
      </div>

      {isCasting ? (
        <CastingPlayerStrip
          players={data.players}
          me={meStats ? { checks: meStats.checks, health: meStats.health, keys: meStats.keys } : null}
          gameState={data.game.state}
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

        {isCasting ? (
  <CastingSidebar
    gameId={gameId}
    state={data.game.state}
    dayNumber={data.game.roundNumber}
    nominees={(data.casting?.nominees ?? []).map((id) => {
      const p = data.players.find((x) => x.userId === id);
      return { userId: id, username: p?.username ?? id };
    })}
    onSavedVotes={load}
    messages={data.messages}
  />
) : (
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
)}
      </div>
    </div>
  );
}
