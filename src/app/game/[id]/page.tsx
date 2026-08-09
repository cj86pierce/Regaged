"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PlayerStrip from "./components/PlayerStrip";
import CastingPlayerStrip from "./components/CastingPlayerStrip";
import ChatPanel from "./components/ChatPanel";
import CastingChatPanel from "./components/CastingChatPanel";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import PmPanel from "./components/PmPanel";
import type { AvatarConfig } from "@/components/Avatar";
import CastingSidebar from "./components/CastingSidebar";
import RookiesBetPanel from "./components/RookiesBetPanel";
import SurvivorPanel from "./components/SurvivorPanel";

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
  castingDayMiniGameScore?: number;
  tribe?: string | null;
  food?: number;
  water?: number;
  hasImmunity?: boolean;
  challengeScore?: number;
  avatar: AvatarConfig;
  slotDesigns?: Partial<Record<import("@/components/Avatar").SlotDesignType, string>>;
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
  game: {
    id: string;
    number: number;
    gameType: string;
    state: string;
    roundNumber: number;
    createdAt?: string;
    povUserId: string | null;
    hohUserId?: string | null;
    povSavedUserId?: string | null;
    frookiesPhase?: string | null;
    stateEndsAt: string | null;
    survivorPhase?: string | null;
    survivorMerged?: boolean;
    survivorIsMerge?: boolean;
    losingTribe?: string | null;
    survivorSupplies?: {
      tribeAFood: number;
      tribeAWater: number;
      tribeAFire: boolean;
      tribeBFood: number;
      tribeBWater: number;
      tribeBFire: boolean;
      tribeAWeather?: string;
      tribeBWeather?: string;
      tribeAGatherReadyAt?: string | null;
      tribeBGatherReadyAt?: string | null;
      tribeARainUntil?: string | null;
      tribeBRainUntil?: string | null;
      tribeAFireUntil?: string | null;
      tribeBFireUntil?: string | null;
    };
  };
  lobby: {
    current: number;
    needed: number;
    lobbyReadyAt?: string | null;
    botsFillAt?: string | null;
  } | null;
  voteInfo: { myVoteTargetUserId?: string | null; myRankings?: Record<string, number> } | null;
  nomineeCUserId?: string;
  nomineeDUserId?: string;
  players: Player[];
  messages: Message[];
  pagination: { page: number; pageSize: number; totalPages: number; totalCount: number };
  dropEvents?: DropEventsMap;
  carePackages?: Array<{
    eventId: string;
    claimedAt: string | null;
    options: { slotIndex: number; kind: "APPLE" | "KEY" | "POISON" }[];
  }>;
  casting?: { nominees: string[]; myVoted: boolean };
  jury?: {
    finalists: { userId: string; username: string }[];
    isJuror: boolean;
    myVoteTargetUserId: string | null;
    voteCount: number;
    jurorCount: number;
  } | null;
  myTribe?: string | null;
  viewTribe?: string | null;
  tribeLobbies?: boolean;
};

function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Isolated 1s clock so the rest of the game page doesn't re-render every second. */
function PhaseTimer(props: {
  stateEndsAt: string | null;
  enabled: boolean;
  onExpired: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const lastZeroRef = useRef<string | null>(null);
  const onExpiredRef = useRef(props.onExpired);
  onExpiredRef.current = props.onExpired;

  useEffect(() => {
    if (!props.enabled || !props.stateEndsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [props.enabled, props.stateEndsAt]);

  const timeLeft = useMemo(() => {
    if (!props.stateEndsAt) return null;
    return Math.max(0, Math.ceil((new Date(props.stateEndsAt).getTime() - now) / 1000));
  }, [props.stateEndsAt, now]);

  useEffect(() => {
    if (!props.enabled || !props.stateEndsAt || timeLeft !== 0) return;
    if (lastZeroRef.current === props.stateEndsAt) return;
    lastZeroRef.current = props.stateEndsAt;
    onExpiredRef.current();
  }, [props.enabled, props.stateEndsAt, timeLeft]);

  if (timeLeft === null) return null;
  return (
    <span>
      Ends in <b>{fmtHMS(timeLeft)}</b>
    </span>
  );
}

function BotFillTimer(props: { botsFillAt: string; onReady: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);
  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [props.botsFillAt]);

  const timeLeft = Math.max(0, Math.ceil((new Date(props.botsFillAt).getTime() - now) / 1000));

  useEffect(() => {
    if (timeLeft > 0) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    onReadyRef.current();
  }, [timeLeft]);

  if (timeLeft <= 0) return <span>Bot fill…</span>;
  return (
    <span>
      Bot fill in <b>{fmtHMS(timeLeft)}</b>
    </span>
  );
}

const POLL_MS = 25_000;

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
  /** Which tribe lobby to show (A/B). Players can switch to view the other tribe. */
  const [lobbyTribe, setLobbyTribe] = useState<"A" | "B" | null>(null);
  // Poll/timers close over stale state — always read the current tribe from a ref.
  const lobbyTribeRef = useRef<"A" | "B" | null>(null);

  async function load(opts?: { bust?: boolean; tribe?: "A" | "B" }) {
    const tribe = opts?.tribe ?? lobbyTribeRef.current ?? undefined;
    const tribeQ = tribe ? `&tribe=${tribe}` : "";
    const q = `page=${page}&pageSize=25${tribeQ}${opts?.bust ? `&_=${Date.now()}` : ""}`;
    const res = await fetch(`/api/game/${gameId}/state?${q}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load game");
    setData(json);
    if (opts?.tribe === "A" || opts?.tribe === "B") {
      lobbyTribeRef.current = opts.tribe;
      setLobbyTribe(opts.tribe);
    } else if (
      lobbyTribeRef.current == null &&
      (json.viewTribe === "A" || json.viewTribe === "B")
    ) {
      lobbyTribeRef.current = json.viewTribe;
      setLobbyTribe(json.viewTribe);
    }

    if (
      json.game.gameType === "FASTING" ||
      json.game.gameType === "FASTING_BOT" ||
      json.game.gameType === "FROOKIES" ||
      json.game.gameType === "ROOKIES" ||
      json.game.gameType === "FROOKIES_BOT" ||
      json.game.gameType === "ROOKIES_BOT" ||
      json.game.gameType === "SURVIVOR" ||
      json.game.gameType === "SURVIVOR_BOT"
    ) {
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
    let cancelled = false;
    function tick() {
      if (document.hidden) return;
      load().catch((e) => {
        if (!cancelled) setError(e.message);
      });
    }
    tick();
    const poll = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, page]);

  useEffect(() => {
    function refreshVisibleGame() {
      if (document.visibilityState === "visible") {
        load({ bust: true }).catch(() => {});
      }
    }

    window.addEventListener("focus", refreshVisibleGame);
    document.addEventListener("visibilitychange", refreshVisibleGame);
    return () => {
      window.removeEventListener("focus", refreshVisibleGame);
      document.removeEventListener("visibilitychange", refreshVisibleGame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, page]);

  function onPhaseExpired() {
    if (!data || data.game.state === "COMPLETED") return;
    (async () => {
      await fetch("/api/cron/tick", { method: "POST", credentials: "include" }).catch(() => null);
      await load({ bust: true }).catch(() => null);
      setTimeout(() => load({ bust: true }).catch(() => null), 750);
    })();
  }

  async function sendChat() {
    if (sending) return;
    setError(null);

    const text = chatText;
    if (!text.trim()) return;

    // Chat always posts to your own tribe; don't send while viewing the other lobby.
    if (
      data?.tribeLobbies &&
      (data.myTribe === "A" || data.myTribe === "B") &&
      data.viewTribe &&
      data.viewTribe !== data.myTribe
    ) {
      setError("Switch back to your tribe to chat.");
      return;
    }

    setSending(true);

    // Spectators (incl. owners) may be viewing a Survivor tribe lobby — tag the message.
    const tribeForChat =
      lobbyTribe === "A" || lobbyTribe === "B"
        ? lobbyTribe
        : data?.viewTribe === "A" || data?.viewTribe === "B"
          ? data.viewTribe
          : undefined;

    const res = await fetch(`/api/game/${gameId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, ...(tribeForChat ? { tribe: tribeForChat } : {}) }),
    });

    const json = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(json?.error ?? "Chat failed");
      return;
    }

    setChatText("");
    setPage(1);

    const real = json.message as Message;
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [real, ...prev.messages] };
    });
    load({ bust: true }).catch(() => {});
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
    load({ bust: true }).catch((e) => setError(e.message));
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
    load({ bust: true }).catch((e) => setError(e.message));
  }

  async function submitJuryVote(targetUserId: string) {
    setError(null);
    const res = await fetch(`/api/game/${gameId}/jury-vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Jury vote failed");
      return;
    }
    load({ bust: true }).catch((e) => setError(e.message));
  }

  async function submitPovSave(targetUserId: string | null) {
    setError(null);
    const res = await fetch(`/api/game/${gameId}/pov-save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "POV save failed");
      return;
    }
    load({ bust: true }).catch((e) => setError(e.message));
  }

  if (!data) return <p style={{ padding: 16 }}>Loading game…</p>;

  const isCasting =
    data.game.gameType === "CASTING" || data.game.gameType === "CASTING_BOT";
  const isSurvivor =
    data.game.gameType === "SURVIVOR" || data.game.gameType === "SURVIVOR_BOT";
  const isRookiesLive = data.game.gameType === "ROOKIES" || data.game.gameType === "ROOKIES_BOT";
  const maxPlayers = isCasting
    ? 20
    : isSurvivor
      ? data.game.survivorIsMerge
        ? 10
        : 20
      : 15;

  const myNomLockedIn = data.myNomLocked === true;
  const myVoteLockedIn = data.voteInfo?.myVoteTargetUserId ?? null;

  const meStats = data.meUserId ? data.players.find((p) => p.userId === data.meUserId) ?? null : null;

  const tribeLobbies = !!data.tribeLobbies;
  // Prefer the user's chosen lobby so polls can't flash them back to their tribe.
  const viewTribe = lobbyTribe ?? data.viewTribe ?? null;
  const myTribe = data.myTribe ?? null;
  const viewingOtherTribe =
    !!tribeLobbies &&
    (myTribe === "A" || myTribe === "B") &&
    !!viewTribe &&
    viewTribe !== myTribe;

  const lobbyPlayers =
    tribeLobbies && (viewTribe === "A" || viewTribe === "B")
      ? data.players.filter((p) => p.tribe === viewTribe)
      : data.players;

  const lobbyLabel =
    tribeLobbies && viewTribe === "A"
      ? "Tribe A lobby"
      : tribeLobbies && viewTribe === "B"
        ? "Tribe B lobby"
        : isSurvivor && data.game.survivorIsMerge
          ? "Merge lobby"
          : null;

  return (
    <div className="game-page-content pageShell">
      <div style={{ marginBottom: 10 }}>
        <div className="gameHeaderTitle" style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
          {data.game.gameType.replace(/_/g, " ")}{" "}
          <span style={{ opacity: 0.55, fontWeight: 800 }}>#{data.game.number}</span>
          {lobbyLabel ? (
            <span style={{ marginLeft: 10, fontSize: 16, fontWeight: 900, color: "#2e7d32" }}>
              · {lobbyLabel}
            </span>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            opacity: 0.8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {data.game.state === "ENROLLING" && data.lobby ? (
            <>
              Filling: <b>{data.lobby.current}/{maxPlayers}</b>
              <span style={{ opacity: 0.7 }}>({data.lobby.needed} needed)</span>
              {data.lobby.botsFillAt || data.lobby.lobbyReadyAt ? (
                <>
                  <span>·</span>
                  <BotFillTimer
                    botsFillAt={(data.lobby.botsFillAt || data.lobby.lobbyReadyAt)!}
                    onReady={onPhaseExpired}
                  />
                </>
              ) : null}
            </>
          ) : data.game.state === "COMPLETED" ? (
            <>Game ended · Final placements below</>
          ) : (
            <>
              <span>
                Round <b>{data.game.roundNumber}</b>
              </span>
              <span>·</span>
              <span>
                <b>
                  {(isSurvivor && data.game.survivorPhase
                    ? data.game.survivorPhase
                    : data.game.state
                  ).replace(/_/g, " ")}
                </b>
              </span>
              {data.game.stateEndsAt && (
                <>
                  <span>·</span>
                  <PhaseTimer
                    stateEndsAt={data.game.stateEndsAt}
                    enabled={data.game.state !== "ENROLLING" && data.game.state !== "COMPLETED"}
                    onExpired={onPhaseExpired}
                  />
                </>
              )}
            </>
          )}
        </div>

        {tribeLobbies ? (
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {myTribe === "A" || myTribe === "B" ? (
              <span style={{ fontSize: 12, opacity: 0.85 }}>
                Your tribe: <b>{myTribe}</b>
                {viewTribe && viewTribe !== myTribe ? (
                  <> · viewing <b>Tribe {viewTribe}</b></>
                ) : null}
              </span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 800 }}>Spectate tribe:</span>
            )}
            {(["A", "B"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  lobbyTribeRef.current = t;
                  setLobbyTribe(t);
                  void load({ bust: true, tribe: t }).catch((e) => setError(e.message));
                }}
                style={{
                  fontWeight: 900,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: viewTribe === t ? "#66bb6a" : "var(--bg-btn-disabled)",
                  color: viewTribe === t ? "#1b3d1f" : "inherit",
                  cursor: "pointer",
                }}
              >
                {myTribe === "A" || myTribe === "B"
                  ? t === myTribe
                    ? `My tribe (${t})`
                    : `Other tribe (${t})`
                  : `Tribe ${t}`}
              </button>
            ))}
          </div>
        ) : null}

      </div>

      {isCasting ? (
        <CastingPlayerStrip
          gameId={gameId}
          players={data.players}
          me={meStats ? { checks: meStats.checks, health: meStats.health, keys: meStats.keys } : null}
          gameState={data.game.state}
        />
      ) : (
        <PlayerStrip
          players={lobbyPlayers}
          columns={
            tribeLobbies || (isSurvivor && data.game.survivorIsMerge)
              ? 10
              : isSurvivor
                ? 20
                : 15
          }
          povUserId={data.game.povUserId}
          hohUserId={data.game.hohUserId}
          gameType={data.game.gameType}
          povSavedUserId={data.game.povSavedUserId}
          frookiesPhase={data.game.frookiesPhase}
          onPovSave={submitPovSave}
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

      <div
        className="gamePageGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(260px, 360px)",
          gap: 14,
          marginTop: 12,
          alignItems: "stretch",
          minHeight: 400,
        }}
      >
        <div>
          {viewingOtherTribe ? (
            <div
              style={{
                marginBottom: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Viewing Tribe {viewTribe} (read-only chat). Switch to My tribe ({myTribe}) to talk and
              compete.
            </div>
          ) : null}
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
              players={lobbyPlayers.map((p) => ({ userId: p.userId, username: p.username, status: p.status }))}
            />
          )}

          {error && (
            <div style={{ marginTop: 10, color: "var(--text-error)" }}>
              <b>{error}</b>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          {isRookiesLive && <RookiesBetPanel gameId={gameId} />}
          {isSurvivor && !viewingOtherTribe && (
            <SurvivorPanel
              gameId={gameId}
              phase={data.game.survivorPhase}
              roundNumber={data.game.roundNumber}
              losingTribe={data.game.losingTribe}
              merged={!!data.game.survivorMerged}
              meUserId={data.meUserId}
              players={data.players}
              supplies={data.game.survivorSupplies ?? null}
              onRefresh={() => load({ bust: true }).catch((e) => setError(e.message))}
            />
          )}

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
              carePackages={data.carePackages ?? []}
              onReload={load}
              meUserId={data.meUserId}
            />
          ) : isSurvivor ? (
            <Sidebar
              gameState={data.game.state}
              roundNumber={data.game.roundNumber}
              survivorPhase={data.game.survivorPhase}
              nomSelected={[]}
              canConfirmNoms={false}
              onConfirmNoms={async () => {}}
              myNomLockedIn={false}
              evictSelected={null}
              canConfirmVote={false}
              onConfirmVote={async () => {}}
              myVoteLockedIn={null}
              myRankingsLocked={false}
              messages={data.messages}
              gameId={gameId}
              gameType={data.game.gameType}
              meUserId={data.meUserId}
              povUserId={null}
              players={lobbyPlayers.map((p) => ({
                userId: p.userId,
                username: p.username,
                status: p.status,
                isNominee: false,
              }))}
              rookiesNominees={[]}
              onReload={() => load().catch((e) => setError(e.message))}
            />
          ) : (
            <Sidebar
              gameState={data.game.state}
              roundNumber={data.game.roundNumber}
              nomSelected={nomSelected}
              canConfirmNoms={
                !isCasting &&
                data.game.state === "ROUND_NOMINATE" &&
                !myNomLockedIn &&
                (((data.game.gameType === "FROOKIES" || data.game.gameType === "FROOKIES_BOT") &&
                  data.game.frookiesPhase === "HOH_RENOM")
                  ? nomSelected.length === 1 && data.game.hohUserId === data.meUserId
                  : nomSelected.length === 2 &&
                    (data.game.gameType === "FROOKIES" ||
                    data.game.gameType === "FROOKIES_BOT" ||
                    data.game.gameType === "ROOKIES" ||
                    data.game.gameType === "ROOKIES_BOT"
                      ? data.game.hohUserId === data.meUserId
                      : true))
              }
              onConfirmNoms={confirmNoms}
              myNomLockedIn={myNomLockedIn}
              evictSelected={evictSelected}
              canConfirmVote={
                !isCasting && data.game.state === "ROUND_VOTE" && !myVoteLockedIn && !!evictSelected
              }
              onConfirmVote={confirmVote}
              myVoteLockedIn={myVoteLockedIn}
              myRankingsLocked={
                !!data.voteInfo?.myRankings && Object.keys(data.voteInfo.myRankings).length > 0
              }
              messages={data.messages}
              gameId={gameId}
              gameType={data.game.gameType}
              meUserId={data.meUserId}
              povUserId={data.game.povUserId}
              hohUserId={data.game.hohUserId}
              povSavedUserId={data.game.povSavedUserId}
              frookiesPhase={data.game.frookiesPhase}
              players={data.players.map((p) => ({
                userId: p.userId,
                username: p.username,
                status: p.status,
                isNominee: p.isNominee,
              }))}
              rookiesNominees={data.players
                .filter((p) => p.isNominee)
                .map((p) => ({ userId: p.userId, username: p.username }))}
              onPovSave={submitPovSave}
              onReload={() => load().catch((e) => setError(e.message))}
              jury={data.jury}
              onJuryVote={submitJuryVote}
            />
          )}
        </div>
      </div>
    </div>
  );
}
