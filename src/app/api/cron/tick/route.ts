import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cronAuth";
import { runTick } from "@/lib/runTick";

async function handleTick(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  // Allow authenticated users to trigger tick (keeps games advancing when user has any page open)
  const authErr = await requireCronAuth(req, { allowLoggedInUser: true });
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
