import { NextResponse } from "next/server";
import { assignFastingPov } from "@/lib/fastingPov";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const gameId = (body?.gameId ?? "").toString();
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  try {
    const res = await assignFastingPov(gameId, true);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 400 });
  }
}
