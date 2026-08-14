"use client";

import { useMemo, type ReactNode } from "react";
import { colorLevelSwatch, colorLevelSwatchClass } from "@/lib/colorLevelCss";

type Me = { username: string; karma: number; tMoney: number };

type ColorLevel = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

export default function ColorLevelsClient({
  me,
  equippedColorId,
  levels,
  ownedColorIds,
  ladderMaxId,
}: {
  me: Me;
  equippedColorId: number;
  levels: ColorLevel[];
  ownedColorIds: number[];
  ladderMaxId: number;
}) {
  const owned = useMemo(() => new Set([0, ...ownedColorIds]), [ownedColorIds]);
  const highestLadderId = useMemo(() => {
    let max = 0;
    for (const id of owned) if (id <= ladderMaxId && id > max) max = id;
    return max;
  }, [owned, ladderMaxId]);
  const nextBuyableId = highestLadderId + 1;

  const ladder = levels.filter((l) => l.id <= ladderMaxId);

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

  async function wearColor(colorId: number) {
    const res = await fetch("/api/shop/equip-color", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colorId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json?.error ?? "Could not equip");
    window.location.reload();
  }

  function card(lvl: ColorLevel, opts: {
    locked: boolean;
    canBuy: boolean;
    buttonLabel: string;
    extra?: ReactNode;
  }) {
    const has = owned.has(lvl.id);
    const wearing = equippedColorId === lvl.id;
    const sw = colorLevelSwatch(lvl.name);
    return (
      <div
        key={lvl.id}
        className="shopColorRow"
        style={{
          border: wearing ? "2px solid var(--brand)" : "1px solid var(--border)",
          borderRadius: 12,
          padding: 14,
          background: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: opts.locked && !has ? 0.65 : 1,
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 14, marginBottom: 8 }}>Level {lvl.name}</div>
        <div
          className={`lvlSwatch ${colorLevelSwatchClass(lvl.name, lvl.isAnimated)}`}
          style={{ ["--lvl" as string]: sw, width: 56, height: 56, borderRadius: 10, marginBottom: 10 }}
          title={lvl.name}
        />
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>Power: <b>{lvl.strength}x</b></div>
        <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>Bet max: <b>{lvl.strength * 2} T$</b></div>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Karma: <b>{lvl.karmaNeeded}</b></div>
        {lvl.priceT > 0 ? (
          <div style={{ fontSize: 14, fontWeight: 1000, color: "var(--brand)", marginBottom: 10 }}>{lvl.priceT} R$</div>
        ) : (
          <div style={{ marginBottom: 10 }} />
        )}
        {opts.extra}
        {lvl.id === 0 && <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800 }}>Default</div>}
        {has && wearing && <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800 }}>Wearing</div>}
        {has && !wearing && lvl.id !== 0 && (
          <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800 }}>Owned</div>
        )}
        {!has && opts.locked && (
          <div style={{ fontSize: 11, color: "var(--error-inline)", fontWeight: 800 }}>Locked</div>
        )}
        <div style={{ display: "flex", gap: 6, width: "100%", marginTop: 8 }}>
          {has ? (
            <button
              disabled={wearing}
              onClick={() => wearColor(lvl.id)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10,
                border: "1px solid var(--border)",
                background: wearing ? "var(--bg-btn-disabled)" : "var(--btn-primary-bg)",
                fontWeight: 1000, cursor: wearing ? "not-allowed" : "pointer",
              }}
            >
              {wearing ? "Wearing" : "Wear"}
            </button>
          ) : (
            <button
              disabled={!opts.canBuy}
              onClick={() => buyColor(lvl.id)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10,
                border: "1px solid var(--border)",
                background: opts.canBuy ? "var(--btn-primary-bg)" : "var(--bg-btn-disabled)",
                fontWeight: 1000, cursor: opts.canBuy ? "pointer" : "not-allowed",
              }}
            >
              {opts.buttonLabel}
            </button>
          )}
        </div>
      </div>
    );
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
          20 colors · TV Star is the top
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="shopColorGrid">
        {ladder.map((lvl) => {
          const has = owned.has(lvl.id);
          const isNext = lvl.id === nextBuyableId;
          const canKarma = me.karma >= lvl.karmaNeeded;
          const canMoney = me.tMoney >= lvl.priceT;
          const locked = !has && lvl.id !== nextBuyableId && lvl.id !== 0;
          const canBuy = lvl.id !== 0 && !has && isNext && canKarma && canMoney;
          return card(lvl, {
            locked,
            canBuy,
            buttonLabel: lvl.id === 0 ? "Owned" : isNext ? "Buy" : "Locked",
            extra: !has && isNext && (!canKarma || !canMoney) ? (
              <div style={{ fontSize: 11, color: "var(--error-inline)", fontWeight: 800, marginBottom: 4 }}>
                {canKarma ? "" : "Need karma. "}{canMoney ? "" : "Need R$."}
              </div>
            ) : null,
          });
        })}
      </div>
    </>
  );
}
