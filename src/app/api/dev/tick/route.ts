import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Forward to the real engine
  const res = await fetch("http://localhost:3000/api/cron/tick", { method: "POST" }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Failed to call cron tick" }, { status: 500 });

  const json = await res.json();
  return NextResponse.json(json);
}
