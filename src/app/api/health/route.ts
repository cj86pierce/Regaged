import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // simplest possible DB query
    const result = await prisma.user.count();
    return NextResponse.json({ ok: true, db: "connected", userCount: result });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        name: e?.name ?? null,
        message: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
