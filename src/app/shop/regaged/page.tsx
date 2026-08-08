export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isOwnerUsername } from "@/lib/usernames";
import Link from "next/link";
import RegagedShopClient from "./regaged-client";

export default async function RegagedShopPage() {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return (
      <main style={{ padding: 12 }}>
        <p>You must be logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { tMoney: true, isOwner: true, usernameLower: true },
  });
  if (!me) {
    return (
      <main style={{ padding: 12 }}>
        <p>User not found.</p>
      </main>
    );
  }

  const isOwner = me.isOwner || isOwnerUsername(me.usernameLower);

  const items = await prisma.regagedShopItem.findMany({
    where: isOwner ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const ownedIds = new Set(
    (
      await prisma.regagedShopPurchase.findMany({
        where: { userId, itemId: { in: items.map((i) => i.id) } },
        select: { itemId: true },
      })
    ).map((p) => p.itemId)
  );

  return (
    <main style={{ padding: 12 }}>
      <Link href="/shop/game" style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, display: "inline-block" }}>
        ← Back to Game Shops
      </Link>
      <RegagedShopClient
        initialItems={items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          designType: i.designType,
          designId: i.designId,
          priceT: i.priceT,
          stock: i.stock,
          active: i.active,
          sortOrder: i.sortOrder,
          createdAt: i.createdAt.toISOString(),
          owned: ownedIds.has(i.id),
        }))}
        initialTMoney={me.tMoney}
        isOwner={isOwner}
      />
    </main>
  );
}
