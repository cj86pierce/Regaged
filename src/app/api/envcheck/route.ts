import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbCheck: { database?: string; lastUserCreatedAt?: string; error?: string } = {};
  try {
    const db = await prisma.$queryRaw<[{ current_database: string }]>`SELECT current_database() as current_database`;
    dbCheck.database = db[0]?.current_database ?? null;
    const last = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    dbCheck.lastUserCreatedAt = last?.createdAt.toISOString() ?? null;
  } catch (e) {
    dbCheck.error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    db: dbCheck,
  });
}
