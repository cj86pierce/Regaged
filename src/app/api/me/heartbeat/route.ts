import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { touchUser } from "@/lib/touchUser";

export const dynamic = "force-dynamic";

async function heartbeat(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  await touchUser(userId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  return heartbeat(req);
}

export async function POST(req: Request) {
  return heartbeat(req);
}
