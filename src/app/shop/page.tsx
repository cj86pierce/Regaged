export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ShopClient from "./shop-client";

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

  return (
    <ShopClient
      me={{
        username: me.username,
        karma: me.karma,
        tMoney: me.tMoney,
      }}
      levels={levels}
      ownedColorIds={owned.map((x) => x.colorId)}
    />
  );
}
