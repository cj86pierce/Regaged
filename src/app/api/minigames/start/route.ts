import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isMinigameId } from "@/lib/minigames/registry";
import {
  ARCADE_COST_R,
  arcadeCookieHeader,
  signArcadeSession,
} from "@/lib/minigames/arcadeSession";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** Pay 5 R$ to unlock one arcade minigame session (2h). */
export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const minigameId = body?.minigameId;
  if (!isMinigameId(minigameId)) return bad("Invalid minigame");

  const updated = await prisma.user.updateMany({
    where: { id: userId, tMoney: { gte: ARCADE_COST_R } },
    data: { tMoney: { decrement: ARCADE_COST_R } },
  });
  if (updated.count === 0) {
    return bad(`Not enough R$. Arcade plays cost ${ARCADE_COST_R} R$.`, 402);
  }

  const token = await signArcadeSession({ userId, minigameId });
  const res = NextResponse.json({
    ok: true,
    minigameId,
    cost: ARCADE_COST_R,
    playUrl: `/minigames/${minigameId}`,
  });
  res.headers.set("Set-Cookie", arcadeCookieHeader(token));
  return res;
}
