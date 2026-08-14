export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ColorLevelsClient from "./colors-client";
import { TV_STAR_ID } from "@/lib/colorCatalog";
import { ensureColorLevels } from "@/lib/ensureColorLevels";

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

  await ensureColorLevels();

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, karma: true, tMoney: true, equippedColorId: true },
  });
  if (!me) return <main style={{ padding: 12 }}><p>User not found.</p></main>;

  const levels = await prisma.colorLevel.findMany({
    where: { id: { lte: TV_STAR_ID } },
    orderBy: { id: "asc" },
    select: { id: true, name: true, karmaNeeded: true, priceT: true, strength: true, isAnimated: true },
  });

  const owned = await prisma.userColor.findMany({
    where: { userId },
    select: { colorId: true },
  });
  const ownedColorIds = owned.map((x) => x.colorId);

  return (
    <main style={{ padding: 12 }}>
      <Link href="/shop" style={{ fontSize: 14, opacity: 0.8, marginBottom: 12, display: "inline-block" }}>← Back to Shops</Link>
      {process.env.NODE_ENV !== "production" ? (
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          <Link href="/dev/color-lab" style={{ fontWeight: 800 }}>
            Color lab
          </Link>
          {" —"} preview animations
        </div>
      ) : null}
      <ColorLevelsClient
        me={me}
        equippedColorId={me.equippedColorId ?? 0}
        levels={levels}
        ownedColorIds={ownedColorIds}
        ladderMaxId={TV_STAR_ID}
      />
    </main>
  );
}
