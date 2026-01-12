import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
