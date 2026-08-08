import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { claimDailyLogin, getDailyLoginStatus } from "@/lib/dailyLogin";

export const dynamic = "force-dynamic";

/** Local/dev only until we're ready to ship daily login. */
function dailyLoginAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.DAILY_LOGIN_ENABLED === "1";
}

export async function GET(req: Request) {
  if (!dailyLoginAllowed()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getDailyLoginStatus(userId);
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(req: Request) {
  if (!dailyLoginAllowed()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await claimDailyLogin(userId);
  if (!result.ok) {
    if (result.error === "already_claimed") {
      const status = await getDailyLoginStatus(userId);
      return NextResponse.json(
        { error: "Already claimed today", ...status },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    streak: result.streak,
    longestStreak: result.longestStreak,
    reward: result.reward,
    claimedToday: true,
    nextReward: result.reward,
  });
}
