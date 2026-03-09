export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ColorLevelsClient from "./colors-client";

export default async function ColorLevelsPage() {
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
    select: { username: true, karma: true, tMoney: true, pMoney: true },
  });
  if (!me) return <main style={{ padding: 12 }}><p>User not found.</p></main>;

  const levels = await prisma.colorLevel.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, karmaNeeded: true, priceT: true, strength: true, isAnimated: true },
  });

  const owned = await prisma.userColor.findMany({
    where: { userId },
    select: { colorId: true },
  });

  return (
    <main style={{ padding: 12 }}>
      <Link href="/shop" style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, display: "inline-block" }}>← Back to Shops</Link>
      <ColorLevelsClient
        me={me}
        levels={levels}
        ownedColorIds={owned.map((x) => x.colorId)}
      />
    </main>
  );
}
