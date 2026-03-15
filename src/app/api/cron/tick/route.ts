import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { runTick } from "@/lib/runTick";

async function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  if (req.headers.get("x-vercel-cron") === "1") return null;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  if (auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret) return null;
  // Allow authenticated users to trigger tick (keeps games advancing when user has any page open)
  const userId = await getCurrentUserId(req);
  if (userId) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleTick(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  try {
    const result = await runTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Cron tick failed", e);
    return NextResponse.json(
      { ok: false, error: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleTick(req);
}

export async function POST(req: Request) {
  return handleTick(req);
}
