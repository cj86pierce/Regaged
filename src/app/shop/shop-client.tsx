"use client";

import { useEffect, useMemo, useState } from "react";

type Me = { username: string; karma: number; tMoney: number; pMoney: number };

type ColorLevel = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

type DesignDto = {
  id: string;
  title: string;
  description: string;
  authorUsername: string;
  createdAt: string;
  voteCount: number;
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
function isTvStar(name: string) {
  return name.trim().toLowerCase() === "tv star";
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
  const [tab, setTab] = useState<"colors" | "items" | "designs">("colors");

  const [designsRecent, setDesignsRecent] = useState<DesignDto[]>([]);
  const [designsTop, setDesignsTop] = useState<DesignDto[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [designsError, setDesignsError] = useState<string | null>(null);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  async function refreshDesigns() {
    setDesignsLoading(true);
    setDesignsError(null);
    try {
      const res = await fetch("/api/designs", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDesignsError(json?.error ?? "Failed to load designs");
        setDesignsRecent([]);
        setDesignsTop([]);
        return;
      }
      setDesignsRecent(json.recent ?? []);
      setDesignsTop(json.top ?? []);
    } catch {
      setDesignsError("Failed to load designs");
      setDesignsRecent([]);
      setDesignsTop([]);
    } finally {
      setDesignsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "designs") {
      void refreshDesigns();
    }
  }, [tab]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please choose a 200x230 PNG file.");
      return;
    }
    if (!uploadTitle.trim()) {
      alert("Please enter a title.");
      return;
    }
    if (!uploadDescription.trim()) {
      alert("Please enter a description.");
      return;
    }

    setUploading(true);
    setDesignsError(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadTitle.trim());
      fd.append("description", uploadDescription.trim());

      const res = await fetch("/api/designs", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDesignsError(json?.error ?? "Upload failed");
        return;
      }

      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      await refreshDesigns();
    } catch {
      setDesignsError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function voteDesign(id: string) {
    try {
      const res = await fetch(`/api/designs/${id}/vote`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error ?? "Vote failed");
        return;
      }
      const votes = json.votes as number | undefined;
      if (typeof votes !== "number") return;

      setDesignsRecent((prev) =>
        prev.map((d) => (d.id === id ? { ...d, voteCount: votes } : d)),
      );
      setDesignsTop((prev) =>
        prev
          .map((d) => (d.id === id ? { ...d, voteCount: votes } : d))
          .slice()
          .sort((a, b) => {
            if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }),
      );
    } catch {
      alert("Vote failed");
    }
  }

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Shop</h1>

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
            Money: <b>{me.tMoney}</b> R$
            <div style={{ fontSize: 11, opacity: 0.85 }}>Premium <b>{me.pMoney}</b> P$</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <TabButton active={tab === "colors"} onClick={() => setTab("colors")}>
          Color Levels
        </TabButton>
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          Items (soon)
        </TabButton>
        <TabButton active={tab === "designs"} onClick={() => setTab("designs")}>
          Designs
        </TabButton>
      </div>

      {tab === "colors" && (
        <div style={{ display: "grid", gap: 10 }}>
          {levels
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((lvl) => {
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
                  style={{
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                    display: "grid",
                    gridTemplateColumns: "1fr 160px",
                    gap: 12,
                    alignItems: "center",
                    opacity: isLockedByOrder ? 0.65 : 1,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {/* ✅ animated swatch */}
                      <div
                        className={`lvlSwatch ${tv ? "tvstar" : ""} ${lvl.isAnimated || tv ? "animated" : "static"}`}
                        style={{ ["--lvl" as any]: sw }}
                        title={lvl.name}
                      />
                      <div style={{ fontWeight: 1000, fontSize: 16 }}>
                        {lvl.name} {(lvl.isAnimated || tv) ? "✨" : ""}
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      Requires <b>{lvl.karmaNeeded}</b> karma · Costs <b>{lvl.priceT}</b> R$ · Strength <b>{lvl.strength}</b>
                    </div>

                    {lvl.id === 0 && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 1000, color: "#198754" }}>Default</div>}
                    {has && lvl.id !== 0 && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 1000, color: "#198754" }}>Owned</div>}

                    {!has && isLockedByOrder && (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b02a37" }}>
                        Locked — buy levels in order.
                      </div>
                    )}

                    {!has && isNext && (!canKarma || !canMoney) && (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b02a37" }}>
                        {canKarma ? "" : "Not enough karma. "}
                        {canMoney ? "" : "Not enough R$."}
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
                    {lvl.id === 0 ? "Owned" : has ? "Owned" : isNext ? "Buy" : "Locked"}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {tab === "items" && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}>
          <div style={{ fontWeight: 1000 }}>More shop items soon.</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Next: avatar items, buttons, cosmetic frames, and more.</div>
        </div>
      )}

      {tab === "designs" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          {/* Left: upload form + most recent */}
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Submit a design</div>
              <form onSubmit={handleUpload} style={{ display: "grid", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />
                <textarea
                  placeholder="Description"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.15)",
                    resize: "vertical",
                  }}
                />
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f || null);
                  }}
                />
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  Please upload a 200x230 PNG. Designs with the most votes may be featured in the
                  auction house every 12 hours.
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: uploading ? "#f3f6f9" : "linear-gradient(#ffd85a,#ffb703)",
                    fontWeight: 1000,
                    cursor: uploading ? "not-allowed" : "pointer",
                  }}
                >
                  {uploading ? "Uploading..." : "Upload design"}
                </button>
                {designsError && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#b02a37", fontWeight: 900 }}>
                    {designsError}
                  </div>
                )}
              </form>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 1000, marginBottom: 8 }}>Most recent designs</div>
              {designsLoading && <div style={{ fontSize: 12 }}>Loading designs…</div>}
              {!designsLoading && designsRecent.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>No designs yet.</div>
              )}
              <div style={{ display: "grid", gap: 8 }}>
                {designsRecent.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px minmax(0, 1fr)",
                      gap: 8,
                      padding: 8,
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#fdfdfd",
                    }}
                  >
                    <div
                      style={{
                        width: 120,
                        height: Math.round((120 * 230) / 200),
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "#eee",
                      }}
                    >
                      <img
                        src={`/api/designs/${d.id}/image`}
                        alt={d.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 4, alignContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 1000 }}>{d.title}</div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>
                          by {d.authorUsername} ·{" "}
                          {new Date(d.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                          {d.description}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          justifyContent: "flex-start",
                          marginTop: 4,
                        }}
                      >
                        <button
                          onClick={() => voteDesign(d.id)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: "linear-gradient(#ffd85a,#ffb703)",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Vote
                        </button>
                        <div style={{ fontSize: 12 }}>
                          <b>{d.voteCount}</b> vote{d.voteCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: highest votes */}
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Highest votes</div>
            {designsLoading && <div style={{ fontSize: 12 }}>Loading designs…</div>}
            {!designsLoading && designsTop.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>No designs yet.</div>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {designsTop.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px minmax(0, 1fr)",
                    gap: 8,
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "#fdfdfd",
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: Math.round((80 * 230) / 200),
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#eee",
                    }}
                  >
                    <img
                      src={`/api/designs/${d.id}/image`}
                      alt={d.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 2 }}>
                    <div style={{ fontWeight: 1000 }}>{d.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>
                      by {d.authorUsername} · <b>{d.voteCount}</b> vote
                      {d.voteCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
