import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { isMinigameId, toChallengeScore } from "@/lib/minigames/registry";
import { ARCADE_COOKIE, verifyArcadeSession } from "@/lib/minigames/arcadeSession";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Convert arcade raw metrics → Challenge Score (practice / paid play; not casting). */
export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const minigameId = body?.minigameId;
  const raw = body?.raw;
  if (!isMinigameId(minigameId)) return bad("Invalid minigame");

  const token = parseCookie(req.headers.get("cookie"), ARCADE_COOKIE);
  const session = token ? await verifyArcadeSession(token) : null;
  if (!session || session.userId !== userId || session.minigameId !== minigameId) {
    return bad("No active arcade session for this game. Pay R$ to play.", 403);
  }

  const challengeScore = toChallengeScore(minigameId, raw);
  if (challengeScore == null) return bad("Invalid score payload");

  return NextResponse.json({ ok: true, challengeScore, improved: true });
}
