"use client";

import { useMemo, useState } from "react";

type Me = { username: string; karma: number; tMoney: number; pMoney: number };

type ColorLevel = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

const SWATCH: Record<string, string> = {
  white: "#ffffff", yellow: "#ffeb3b", orange: "#ff9800", "light green": "#8bc34a",
  green: "#2e7d32", blue: "#1e88e5", purple: "#8e24aa", red: "#e53935",
  brown: "#6d4c41", black: "#111111", silver: "#c0c0c0", gold: "#ffd700",
  sky: "#4fc3f7", blood: "#8b0000", "tv star": "#ff66cc",
};

function colorToSwatch(name: string) {
  return SWATCH[name.trim().toLowerCase()] ?? "#ffffff";
}
function isTvStar(name: string) {
  return name.trim().toLowerCase() === "tv star";
}

export default function ColorLevelsClient({
  me,
  levels,
  ownedColorIds,
}: { me: Me; levels: ColorLevel[]; ownedColorIds: number[] }) {
  const owned = useMemo(() => new Set([0, ...ownedColorIds]), [ownedColorIds]);
  const highestOwnedId = useMemo(() => {
    let max = 0;
    for (const id of owned) if (id > max) max = id;
    return max;
  }, [owned]);
  const nextBuyableId = highestOwnedId + 1;

  async function buyColor(colorId: number) {
    const res = await fetch("/api/shop/buy-color", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colorId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error ?? "Purchase failed");
    window.location.reload();
  }

  return (
    <>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Color Levels Shop</h1>
      <div
        className="theme-sidebar-panel"
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: 14,
          borderRadius: 12, marginBottom: 12, border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--brand)" }}>COLOR LEVELS SHOP</div>
        <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--brand)", color: "#fff", fontSize: 11, fontWeight: 1000 }}>SALE</span>
        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.85 }}>
          Items available <b>{levels.length}</b> Items are stock
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="shopColorGrid">
        {levels.slice().sort((a, b) => a.id - b.id).map((lvl) => {
          const has = owned.has(lvl.id);
          const canKarma = me.karma >= lvl.karmaNeeded;
          const canMoney = me.tMoney >= lvl.priceT;
          const isNext = lvl.id === nextBuyableId;
          const isLockedByOrder = !has && lvl.id !== nextBuyableId && lvl.id !== 0;
          const canBuy = lvl.id !== 0 && !has && isNext && canKarma && canMoney;
          const sw = colorToSwatch(lvl.name);
          const tv = isTvStar(lvl.name);

          return (
            <div
              key={lvl.id}
              className="shopColorRow"
              style={{
                border: "1px solid var(--border)", borderRadius: 12, padding: 14,
                background: "var(--bg-card)", display: "flex", flexDirection: "column",
                alignItems: "center", opacity: isLockedByOrder ? 0.65 : 1,
              }}
            >
              <div style={{ fontWeight: 1000, fontSize: 14, marginBottom: 8 }}>Level {lvl.name}</div>
              <div
                className={`lvlSwatch ${tv ? "tvstar" : ""} ${lvl.isAnimated || tv ? "animated" : "static"}`}
                style={{ ["--lvl" as any]: sw, width: 48, height: 48, borderRadius: 10, marginBottom: 10 }}
                title={lvl.name}
              />
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Power: <b>{lvl.strength}</b></div>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Karma: <b>{lvl.karmaNeeded}</b></div>
              <div style={{ fontSize: 14, fontWeight: 1000, color: "var(--brand)", marginBottom: 10 }}>{lvl.priceT} R$</div>
              {lvl.id === 0 && <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800 }}>Default</div>}
              {has && lvl.id !== 0 && <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800 }}>Owned</div>}
              {!has && isLockedByOrder && <div style={{ fontSize: 11, color: "var(--error-inline)", fontWeight: 800 }}>Locked</div>}
              {!has && isNext && (!canKarma || !canMoney) && (
                <div style={{ fontSize: 11, color: "var(--error-inline)", fontWeight: 800, marginBottom: 4 }}>
                  {canKarma ? "" : "Need karma. "}{canMoney ? "" : "Need R$."}
                </div>
              )}
              <button
                disabled={!canBuy}
                onClick={() => buyColor(lvl.id)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: canBuy ? "var(--btn-primary-bg)" : "var(--bg-btn-disabled)",
                  fontWeight: 1000, cursor: canBuy ? "pointer" : "not-allowed",
                }}
              >
                {lvl.id === 0 ? "Owned" : has ? "Owned" : isNext ? "Buy" : "Locked"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
