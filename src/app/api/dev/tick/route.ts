import { NextResponse } from "next/server";
import { blockInProduction } from "@/lib/devOnly";

export async function POST() {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  // Forward to the real engine
  const res = await fetch("http://localhost:3000/api/cron/tick", { method: "POST" }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Failed to call cron tick" }, { status: 500 });

  const json = await res.json();
  return NextResponse.json(json);
}
