import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isMinigameId } from "@/lib/minigames/registry";
import { ARCADE_COOKIE, ARCADE_COST_R, verifyArcadeSession } from "@/lib/minigames/arcadeSession";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Check if the user has a paid arcade unlock for this minigame. */
export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  const url = new URL(req.url);
  const minigameId = url.searchParams.get("minigameId") ?? "";

  let tMoney: number | null = null;
  if (userId) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { tMoney: true },
    });
    tMoney = me?.tMoney ?? 0;
  }

  if (!isMinigameId(minigameId)) {
    return NextResponse.json({
      ok: true,
      unlocked: false,
      cost: ARCADE_COST_R,
      tMoney,
      meUserId: userId ?? null,
    });
  }

  const token = parseCookie(req.headers.get("cookie"), ARCADE_COOKIE);
  const session = token ? await verifyArcadeSession(token) : null;
  const unlocked = !!(session && session.userId === userId && session.minigameId === minigameId);

  return NextResponse.json({
    ok: true,
    unlocked,
    cost: ARCADE_COST_R,
    tMoney,
    meUserId: userId ?? null,
    minigameId,
  });
}
