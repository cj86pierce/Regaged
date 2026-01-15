export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export default async function ShopPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Shop</h1>
        <p>You must be logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, karma: true, tMoney: true },
  });
  if (!me) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Shop</h1>
        <p>User not found.</p>
      </main>
    );
  }

  const levels = await prisma.colorLevel.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, karmaNeeded: true, priceT: true, strength: true, isAnimated: true },
  });

  const owned = await prisma.userColor.findMany({
    where: { userId },
    select: { colorId: true },
  });
  const ownedSet = new Set(owned.map((x) => x.colorId));

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
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 16 }}>{me.username}</div>
        <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)" }}>
            Karma: <b>{me.karma}</b>
          </span>
          <span style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)" }}>
            Money: <b>{me.tMoney}</b> T$
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {levels.map((lvl) => {
          const has = ownedSet.has(lvl.id);
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
                gridTemplateColumns: "1fr 140px",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>
                  {lvl.name} {lvl.isAnimated ? "✨" : ""}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  Requires: <b>{lvl.karmaNeeded}</b> Karma · Costs: <b>{lvl.priceT}</b> T$ · Strength: <b>{lvl.strength}</b>
                </div>

                {has && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#198754" }}>Owned</div>}

                {!has && (!canKarma || !canMoney) && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b02a37" }}>
                    {canKarma ? "" : "Not enough Karma. "}
                    {canMoney ? "" : "Not enough T$."}
                  </div>
                )}
              </div>

              <form
                action="/api/shop/buy-color"
                method="post"
                onSubmit={(e) => {
                  // prevent full page reload; use fetch
                  e.preventDefault();
                }}
                style={{ justifySelf: "end" }}
              >
                <button
                  disabled={!canBuy}
                  onClick={async () => {
                    const res = await fetch("/api/shop/buy-color", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ colorId: lvl.id }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      alert(json?.error ?? "Purchase failed");
                      return;
                    }
                    // simple refresh
                    window.location.reload();
                  }}
                  style={{
                    width: 140,
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
              </form>
            </div>
          );
        })}
      </div>
    </main>
  );
}
