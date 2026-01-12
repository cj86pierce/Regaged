import { NextResponse } from "next/server";
import { blockInProduction } from "@/lib/devOnly";

export async function POST() {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  return NextResponse.json({ error: "Dev route disabled in production build setup." }, { status: 400 });
}
