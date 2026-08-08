"use client";

import { useState } from "react";
import Link from "next/link";
import DesignImage from "@/components/DesignImage";
import { DESIGN_TYPES, designTypeLabel } from "@/lib/designTypes";
import type { DesignType } from "@prisma/client";

type ShopItem = {
  id: string;
  title: string;
  description: string;
  designType: DesignType | string;
  designId: string;
  priceT: number;
  stock: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  owned?: boolean;
};

export default function RegagedShopClient(props: {
  initialItems: ShopItem[];
  initialTMoney: number;
  isOwner: boolean;
}) {
  const [items, setItems] = useState<ShopItem[]>(props.initialItems);
  const [tMoney, setTMoney] = useState(props.initialTMoney);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Owner create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [designType, setDesignType] = useState<DesignType>("HAIR");
  const [priceT, setPriceT] = useState("50");
  const [stock, setStock] = useState("10");
  const [sortOrder, setSortOrder] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const res = await fetch("/api/shop/regaged", { cache: "no-store", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to refresh");
      return;
    }
    setItems(json.items ?? []);
    if (typeof json.tMoney === "number") setTMoney(json.tMoney);
  }

  async function buy(itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/shop/regaged/${itemId}/buy`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Purchase failed");
        return;
      }
      if (typeof json.tMoney === "number") setTMoney(json.tMoney);
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, stock: typeof json.stock === "number" ? json.stock : Math.max(0, i.stock - 1), owned: true }
            : i
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("PNG file is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title);
      form.set("description", description);
      form.set("designType", designType);
      form.set("priceT", String(Math.floor(Number(priceT))));
      form.set("stock", String(Math.floor(Number(stock))));
      form.set("sortOrder", String(Math.floor(Number(sortOrder) || 0)));

      const res = await fetch("/api/shop/regaged", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Create failed");
        return;
      }
      setTitle("");
      setDescription("");
      setPriceT("50");
      setStock("10");
      setSortOrder("0");
      setFile(null);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function patchItem(id: string, patch: Partial<{ priceT: number; stock: number; active: boolean; title: string; description: string; sortOrder: number }>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shop/regaged/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Update failed");
        return;
      }
      if (json.item) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...json.item } : i)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this listing? Players will no longer see it.")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/shop/regaged/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Deactivate failed");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: false } : i)));
    } finally {
      setBusyId(null);
    }
  }

  const visible = props.isOwner ? items : items.filter((i) => i.active);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ marginTop: 0, marginBottom: 6, color: "var(--brand)" }}>Regaged Shop</h1>
        <div style={{ fontSize: 13, fontWeight: 900 }}>
          Balance: <span style={{ color: "var(--brand)" }}>{tMoney} R$</span>
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14, lineHeight: 1.4 }}>
        Official avatar designs. Purchases go to Owned designs — equip at{" "}
        <Link href="/profile/avatar" style={{ color: "var(--brand)", fontWeight: 700 }}>
          Customize Avatar
        </Link>
        .
      </div>

      {error ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--error-inline)", fontWeight: 800 }}>{error}</div>
      ) : null}

      {props.isOwner ? (
        <form
          onSubmit={createItem}
          className="theme-sidebar-panel"
          style={{ padding: 14, borderRadius: 12, marginBottom: 18, display: "grid", gap: 10 }}
        >
          <div style={{ fontWeight: 1000, fontSize: 15 }}>Add listing</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Slot
              <select value={designType} onChange={(e) => setDesignType(e.target.value as DesignType)} style={inputStyle}>
                {DESIGN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {designTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Price (R$)
              <input value={priceT} onChange={(e) => setPriceT(e.target.value)} inputMode="numeric" required style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Stock
              <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" required style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Sort order
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              PNG (200×230)
              <input
                type="file"
                accept="image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                style={{ fontSize: 12 }}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
          <button type="submit" disabled={creating} style={btnStyle}>
            {creating ? "Creating…" : "Create listing"}
          </button>
        </form>
      ) : null}

      {visible.length === 0 ? (
        <div className="theme-sidebar-panel" style={{ padding: 16, borderRadius: 12, fontSize: 13, opacity: 0.85 }}>
          No items in the shop yet.
        </div>
      ) : (
        <div
          className="shopRegagedGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {visible.map((item) => {
            const soldOut = item.stock <= 0;
            const canBuy = !item.owned && !soldOut && item.active;
            return (
              <div
                key={item.id}
                className="theme-card shopRegagedCard"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "var(--bg-card)",
                  display: "flex",
                  flexDirection: "column",
                  opacity: item.active ? 1 : 0.65,
                }}
              >
                <div
                  className="shopRegagedThumb"
                  style={{
                    width: "100%",
                    aspectRatio: "200 / 230",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    overflow: "hidden",
                  }}
                >
                  <DesignImage src={`/api/designs/${item.designId}/image`} alt={item.title} />
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={{ fontWeight: 1000, fontSize: 15, lineHeight: 1.2 }}>{item.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {designTypeLabel(item.designType as DesignType)}
                    {!item.active ? " · Inactive" : ""}
                  </div>
                  {item.description ? (
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>{item.description}</div>
                  ) : null}
                  <div style={{ fontSize: 13, fontWeight: 900, color: "var(--brand)", marginTop: 2 }}>
                    {item.priceT} R$ · {soldOut ? "Sold out" : `${item.stock} left`}
                  </div>

                  <div style={{ marginTop: "auto", display: "grid", gap: 8, paddingTop: 8 }}>
                    {item.owned ? (
                      <Link href="/profile/avatar" style={{ ...btnStyle, textAlign: "center", textDecoration: "none" }}>
                        Owned — Equip →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={!canBuy || busyId === item.id}
                        onClick={() => buy(item.id)}
                        style={{
                          ...btnStyle,
                          opacity: canBuy ? 1 : 0.55,
                          cursor: canBuy ? "pointer" : "not-allowed",
                        }}
                      >
                        {busyId === item.id ? "Buying…" : soldOut ? "Sold out" : !item.active ? "Inactive" : "Buy"}
                      </button>
                    )}

                    {props.isOwner ? (
                      <div style={{ display: "grid", gap: 6, fontSize: 11 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => {
                              const v = prompt("New price (R$)", String(item.priceT));
                              if (v == null) return;
                              const n = Math.floor(Number(v));
                              if (!Number.isFinite(n) || n < 0) return alert("Invalid price");
                              void patchItem(item.id, { priceT: n });
                            }}
                            style={smallBtn}
                          >
                            Price
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => {
                              const v = prompt("New stock", String(item.stock));
                              if (v == null) return;
                              const n = Math.floor(Number(v));
                              if (!Number.isFinite(n) || n < 0) return alert("Invalid stock");
                              void patchItem(item.id, { stock: n });
                            }}
                            style={smallBtn}
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void patchItem(item.id, { active: !item.active })}
                            style={smallBtn}
                          >
                            {item.active ? "Deactivate" : "Activate"}
                          </button>
                          {item.active ? (
                            <button type="button" disabled={busyId === item.id} onClick={() => void deactivate(item.id)} style={smallBtn}>
                              Hide
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-input)",
  color: "inherit",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-btn)",
  color: "var(--text)",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-muted)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};
