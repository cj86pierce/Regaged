import { NextResponse } from "next/server";
import { resolveFastingNominations } from "@/lib/fastingNoms";
import { blockInProduction } from "@/lib/devOnly";

export async function POST(req: Request) {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const gameId = (body?.gameId ?? "").toString();
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  try {
    const res = await resolveFastingNominations(gameId);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 400 });
  }
}
