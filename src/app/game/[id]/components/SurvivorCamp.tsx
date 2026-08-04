"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";

export type CampSupplies = {
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

function Meter(props: {
  label: string;
  value: number;
  max?: number;
  color: string;
  track?: string;
}) {
  const max = props.max ?? 100;
  const pct = Math.max(0, Math.min(100, (props.value / max) * 100));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800 }}>
        <span>{props.label}</span>
        <span style={{ color: props.color }}>{Math.round(props.value)}%</span>
      </div>
      <div
        style={{
          height: 9,
          borderRadius: 999,
          background: props.track ?? "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${props.color}, ${props.color}cc)`,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function weatherMeta(w: string) {
  if (w === "SUN") {
    return {
      label: "Sunny",
      hint: "Hunt for tribe food",
      tint: "linear-gradient(135deg, #fff8e1, #ffe082)",
      accent: "#f9a825",
    };
  }
  if (w === "RAIN") {
    return {
      label: "Rain",
      hint: "Collect water for camp",
      tint: "linear-gradient(135deg, #e3f2fd, #90caf9)",
      accent: "#1565c0",
    };
  }
  return {
    label: "Cloudy",
    hint: "No gathering today",
    tint: "linear-gradient(135deg, #eceff1, #b0bec5)",
    accent: "#546e7a",
  };
}

function msLeft(iso: string | null | undefined) {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

function fmtLeft(ms: number) {
  if (ms <= 0) return "ready";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.ceil(m / 60)}h`;
}

export default function SurvivorCamp(props: {
  gameId: string;
  merged: boolean;
  myTribe: string | null | undefined;
  personalFood: number;
  personalWater: number;
  health: number;
  supplies: CampSupplies;
  onRefresh: () => void;
}) {
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const campTribe =
    props.merged || props.myTribe === "MERGED"
      ? "A"
      : props.myTribe === "A" || props.myTribe === "B"
        ? props.myTribe
        : null;

  const stock = useMemo(() => {
    if (!campTribe) return null;
    const s = props.supplies;
    if (campTribe === "A") {
      return {
        food: s.tribeAFood,
        water: s.tribeAWater,
        fire: s.tribeAFire,
        weather: s.tribeAWeather ?? "SUN",
        gatherReadyAt: s.tribeAGatherReadyAt,
        rainUntil: s.tribeARainUntil,
        fireUntil: s.tribeAFireUntil,
      };
    }
    return {
      food: s.tribeBFood,
      water: s.tribeBWater,
      fire: s.tribeBFire,
      weather: s.tribeBWeather ?? "SUN",
      gatherReadyAt: s.tribeBGatherReadyAt,
      rainUntil: s.tribeBRainUntil,
      fireUntil: s.tribeBFireUntil,
    };
  }, [campTribe, props.supplies]);

  if (!campTribe || !stock) return null;

  void tick; // drive countdown re-renders
  const weather = weatherMeta(stock.weather);
  const gatherMs = msLeft(stock.gatherReadyAt);
  const rainMs = msLeft(stock.rainUntil);
  const fireMs = !stock.fire ? msLeft(stock.fireUntil) : 0;
  const raining = rainMs > 0;
  const gatherReady = gatherMs <= 0;
  const lowPersonal = props.personalFood < 15 || props.personalWater < 15;

  async function act(action: "eat" | "drink" | "gather") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/game/${props.gameId}/survivor/camp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, amount }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json?.error ?? "Failed");
      props.onRefresh();
      return;
    }
    if (action === "gather" && json.kind === "WATER") {
      setMsg("Collecting rain for the tribe — water arrives when the storm finishes.");
    } else if (action === "gather") {
      setMsg("+10 tribe food from the hunt.");
    } else {
      setMsg(action === "eat" ? `Ate ${amount} from camp supplies.` : `Drank ${amount} from camp supplies.`);
    }
    props.onRefresh();
  }

  return (
    <div
      style={{
        marginBottom: 10,
        borderRadius: 12,
        border: "1px solid rgba(46,125,50,0.28)",
        background:
          "linear-gradient(160deg, rgba(232,245,233,0.98) 0%, rgba(255,248,225,0.92) 48%, rgba(255,255,255,0.95) 100%)",
        padding: 12,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 1000, color: "#1b5e20", fontSize: 13, letterSpacing: 0.2 }}>
            Camp {props.merged ? "· merge beach" : `· Tribe ${campTribe}`}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
            Personal meters (blue) · tribe stock · fire first
          </div>
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: weather.tint,
            border: `1px solid ${weather.accent}55`,
            fontSize: 11,
            fontWeight: 900,
            color: "#263238",
            whiteSpace: "nowrap",
          }}
          title={weather.hint}
        >
          {weather.label}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div
          style={{
            borderRadius: 10,
            padding: 10,
            background: "linear-gradient(180deg, rgba(227,242,253,0.9), rgba(255,255,255,0.85))",
            border: "1px solid rgba(25,118,210,0.22)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 1000, color: "#1565c0" }}>You</div>
          <Meter label="Food" value={props.personalFood} color="#1e88e5" />
          <Meter label="Water" value={props.personalWater} color="#039be5" />
          <Meter
            label="Health"
            value={props.health}
            color={props.health < 30 ? "#c62828" : "#43a047"}
          />
          {lowPersonal && (
            <div style={{ fontSize: 10, fontWeight: 800, color: "#c62828" }}>
              Low supplies — eat/drink or risk medevac.
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: 10,
            padding: 10,
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(0,0,0,0.1)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 1000, color: "#37474f" }}>Tribe stock</div>
          <Meter label="Food" value={stock.food} max={80} color="#455a64" track="rgba(0,0,0,0.1)" />
          <Meter label="Water" value={stock.water} max={80} color="#37474f" track="rgba(0,0,0,0.1)" />
          <div
            style={{
              marginTop: 2,
              padding: "7px 8px",
              borderRadius: 8,
              background: stock.fire
                ? "linear-gradient(90deg, #ff8a65, #ffcc80)"
                : "linear-gradient(90deg, #90a4ae, #cfd8dc)",
              fontSize: 11,
              fontWeight: 900,
              color: stock.fire ? "#4e342e" : "#37474f",
              textAlign: "center",
            }}
          >
            {stock.fire
              ? "Fire lit — safe to eat & drink"
              : fireMs > 0
                ? `Fire out · relights in ${fmtLeft(fireMs)}`
                : "Fire out — do not eat or drink"}
          </div>
        </div>
      </div>

      {raining && (
        <div
          style={{
            marginTop: 8,
            padding: "7px 9px",
            borderRadius: 8,
            background: "rgba(21,101,192,0.1)",
            border: "1px solid rgba(21,101,192,0.2)",
            fontSize: 11,
            fontWeight: 800,
            color: "#0d47a1",
          }}
        >
          Collecting rain… +10 tribe water in {fmtLeft(rainMs)}. No drinking from stock until then.
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800 }}>Take from stock</span>
        <button
          type="button"
          disabled={busy || amount <= 1}
          onClick={() => setAmount((a) => Math.max(1, a - 1))}
          style={chipBtn}
        >
          −
        </button>
        <span style={{ fontWeight: 1000, minWidth: 18, textAlign: "center" }}>{amount}</span>
        <button
          type="button"
          disabled={busy || amount >= 10}
          onClick={() => setAmount((a) => Math.min(10, a + 1))}
          style={chipBtn}
        >
          +
        </button>
        <button
          type="button"
          disabled={busy || !stock.fire}
          onClick={() => void act("eat")}
          style={actionBtn(stock.fire ? "#2e7d32" : "#9e9e9e")}
          title={!stock.fire ? "Never eat with fire out" : "1 stock → +5% personal food"}
        >
          Eat
        </button>
        <button
          type="button"
          disabled={busy || raining || !stock.fire}
          onClick={() => void act("drink")}
          style={actionBtn(stock.fire && !raining ? "#0277bd" : "#9e9e9e")}
          title={
            !stock.fire
              ? "Never drink with fire out"
              : raining
                ? "Can't drink while collecting rain"
                : "1 stock → +5% personal water"
          }
        >
          Drink
        </button>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || stock.weather === "CLOUDY" || !gatherReady || raining}
          onClick={() => void act("gather")}
          style={{
            ...actionBtn(
              stock.weather === "CLOUDY" || !gatherReady || raining ? "#9e9e9e" : "#6d4c41"
            ),
            flex: "1 1 180px",
          }}
        >
          {stock.weather === "SUN"
            ? "Hunt food (−6% water)"
            : stock.weather === "RAIN"
              ? "Collect water (−6% food)"
              : "Can't gather (cloudy)"}
        </button>
        {!gatherReady && (
          <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 700 }}>
            Ready in {fmtLeft(gatherMs)}
          </span>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.4, opacity: 0.72 }}>
        Day change: −6% food / −5% water. Share tribe stock. Fire out = hard penalty if you eat/drink.
        Both personal meters at 0 → high medevac risk.
      </div>

      {msg && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 900,
            color: msg.toLowerCase().includes("fire") || msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("can't") || msg.toLowerCase().includes("need")
              ? "#b71c1c"
              : "#1b5e20",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#fff",
  fontWeight: 1000,
  cursor: "pointer",
};

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.12)",
    background: bg,
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 12,
  };
}
