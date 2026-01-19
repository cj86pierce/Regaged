"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerStrip from "./components/PlayerStrip";
import ChatPanel from "./components/ChatPanel";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import PmPanel from "./components/PmPanel";
import type { AvatarConfig } from "@/components/Avatar";

// ✅ CASTING-only components
import CastingPlayerStrip from "./components/CastingPlayerStrip";
import CastingsPanel from "./components/CastingsPanel";

type Player = {
  userId: string;
  username: string;
  status: "ACTIVE" | "ELIMINATED";
  lastActiveAt: string;
  eliminatedPlace: number | null;
  isNominee: boolean;
  avatar: AvatarConfig;

  // ✅ CASTING stats (harmless for FASTING; they’ll just be 0/100/0 if returned)
  checks?: number;
  health?: number;
  keys?: number;
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

    // clear fasting-only selections when not in those states
    if (json.game.state !== "ROUND_NOMINATE") setNomSelected([]);
    if (json.game.state !== "ROUND_VOTE") setEvictSelected(null);
    if (json.myNomLocked) setNomSelected([]);
    if (json.voteInfo?.myVoteTargetUserId) setEvictSelected(null);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    const poll = setInterval(() => load().catch(() => {}), 9000);
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

  const myNomLockedIn = data.myNomLocked === true;
  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;

  // Castings player cap
  const maxPlayers = isCasting ? 20 : 15;

  // ✅ CASTING: compute only YOUR stats for the right panel
  const me = isCasting && data.meUserId ? data.players.find((p) => p.userId === data.meUserId) ?? null : null;

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

        {isCasting && (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Castings mode: 12-hour days · keys win (tiebreak: checks → health)
          </div>
        )}
      </div>

      {/* ✅ CASTING uses its own strip, FASTING stays untouched */}
     {data.game.gameType === "CASTING" ? (
  <CastingPlayerStrip
    players={data.players}
    me={
      data.meUserId
        ? (() => {
            const me = data.players.find((p) => p.userId === data.meUserId);
            return me ? { checks: me.checks, health: me.health, keys: me.keys } : null;
          })()
        : null
    }
  />
) : (
        <PlayerStrip
          players={data.players}
          povUserId={isFasting ? data.game.povUserId : null}
          gameState={data.game.state}
          meUserId={data.meUserId}
          myNomLockedIn={isFasting ? myNomLockedIn : true}
          myVoteLockedIn={isFasting ? myVoteLockedIn : null}
          nomSelected={isFasting ? nomSelected : []}
          setNomSelected={isFasting ? setNomSelected : () => {}}
          evictSelected={isFasting ? evictSelected : null}
          setEvictSelected={isFasting ? setEvictSelected : () => {}}
        />
      )}

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

        {/* ✅ CASTING uses right-side stats panel; FASTING sidebar untouched */}
        {isCasting ? (
          <CastingsPanel
            gameNumber={data.game.number}
            dayNumber={data.game.roundNumber}
            timeLeft={timeLeft}
            me={
              me
                ? {
                    checks: me.checks ?? 0,
                    health: me.health ?? 100,
                    keys: me.keys ?? 0,
                  }
                : null
            }
          />
        ) : (
          <Sidebar
            gameState={data.game.state}
            roundNumber={data.game.roundNumber}
            nomSelected={isFasting ? nomSelected : []}
            canConfirmNoms={isFasting && data.game.state === "ROUND_NOMINATE" && !myNomLockedIn && nomSelected.length === 2}
            onConfirmNoms={isFasting ? confirmNoms : async () => {}}
            myNomLockedIn={isFasting ? myNomLockedIn : true}
            evictSelected={isFasting ? evictSelected : null}
            canConfirmVote={isFasting && data.game.state === "ROUND_VOTE" && !myVoteLockedIn && !!evictSelected}
            onConfirmVote={isFasting ? confirmVote : async () => {}}
            myVoteLockedIn={isFasting ? myVoteLockedIn : null}
            messages={data.messages}
          />
        )}
      </div>
    </div>
  );
}
