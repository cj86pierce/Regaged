/**
 * Cron tick for bot/live game advancement.
 * Delegates to shared runTick (throttled bot actions, due-only advances).
 */
import { NextResponse } from "next/server";
import { runTick } from "@/lib/runTick";
import { requireCronAuth } from "@/lib/cronAuth";

export async function GET(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runTick();
  return NextResponse.json({ ok: true, bot: r });
}

export async function POST(req: Request) {
  if (process.env.CRON_DISABLED === "1") return NextResponse.json({ ok: true, disabled: true });
  const authErr = await requireCronAuth(req);
  if (authErr) return authErr;

  const r = await runTick();
  return NextResponse.json({ ok: true, bot: r });
}
