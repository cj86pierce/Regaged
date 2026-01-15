"use client";

import { useMemo, useState } from "react";

type Me = { username: string; karma: number; tMoney: number };

type ColorLevel = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

const SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#ffeb3b",
  orange: "#ff9800",
  "light green": "#8bc34a",
  green: "#2e7d32",
  blue: "#1e88e5",
  purple: "#8e24aa",
  red: "#e53935",
  brown: "#6d4c41",
  black: "#111111",
  silver: "#c0c0c0",
  gold: "#ffd700",
  sky: "#4fc3f7",
  blood: "#8b0000",
  "tv star": "#ff66cc",
};

function colorToSwatch(name: string) {
  return SWATCH[name.trim().toLowerCase()] ?? "#ffffff";
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.12)",
        background: active ? "#fff" : "#f3f6f9",
        fontWeight: 1000,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function ShopClient({
  me,
  levels,
  ownedColorIds,
}: {
  me: Me;
  levels: ColorLevel[];
  ownedColorIds: number[];
}) {
  const [tab, setTab] = useState<"colors" | "items">("colors");
  const owned = useMemo(() => new Set(ownedColorIds), [ownedColorIds]);

  async function buyColor(colorId: number) {
    const res = await fetch("/api/shop/buy-color", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ colorId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error ?? "Purchase failed");
      return;
    }
    // simplest: refresh so balances + owned update
    window.location.reload();
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Shop</h1>

      {/* Header balances */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 1000 }}>{me.username}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)" }}>
            Karma: <b>{me.karma}</b>
          </div>
          <div style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)" }}>
            Money: <b>{me.tMoney}</b> T$
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <TabButton active={tab === "colors"} onClick={() => setTab("colors")}>
          Color Levels
        </TabButton>
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          Items (soon)
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === "colors" && (
        <div style={{ display: "grid", gap: 10 }}>
          {levels.map((lvl) => {
            const has = owned.has(lvl.id);
            const canKarma = me.karma >= lvl.karmaNeeded;
            const canMoney = me.tMoney >= lvl.priceT;
            const canBuy = !has && canKarma && canMoney;

            return (
              <div
                key={lvl.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                  display: "grid",
                  gridTemplateColumns: "1fr 160px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div
                      title={lvl.name}
                      style={{
                        width: 44,
                        height: 18,
                        borderRadius: 8,
                        background: colorToSwatch(lvl.name),
                        border: "1px solid rgba(0,0,0,0.85)",
                      }}
                    />
                    <div style={{ fontWeight: 1000, fontSize: 16 }}>
                      {lvl.name} {lvl.isAnimated ? "✨" : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    Requires <b>{lvl.karmaNeeded}</b> karma · Costs <b>{lvl.priceT}</b> T$ · Strength <b>{lvl.strength}</b>
                  </div>

                  {has && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 1000, color: "#198754" }}>Owned</div>}

                  {!has && (!canKarma || !canMoney) && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b02a37" }}>
                      {canKarma ? "" : "Not enough karma. "}
                      {canMoney ? "" : "Not enough T$."}
                    </div>
                  )}
                </div>

                <button
                  disabled={!canBuy}
                  onClick={() => buyColor(lvl.id)}
                  style={{
                    width: 160,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: canBuy ? "linear-gradient(#ffd85a,#ffb703)" : "#f3f6f9",
                    fontWeight: 1000,
                    cursor: canBuy ? "pointer" : "not-allowed",
                  }}
                >
                  {has ? "Owned" : "Buy"}
                </button>
              </div>
            );
          })}

          {levels.length === 0 && (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}>
              No color levels found. (You’ll need to seed the ColorLevel table.)
            </div>
          )}
        </div>
      )}

      {tab === "items" && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}>
          <div style={{ fontWeight: 1000 }}>More shop items soon.</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Next: avatar items, buttons, cosmetic frames, and more.
          </div>
        </div>
      )}
    </main>
  );
}
