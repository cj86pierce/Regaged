import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailVerifyDisabled } from "@/lib/emailVerification";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbCheck: { database?: string; lastUserCreatedAt?: string; error?: string } = {};
  try {
    const db = await prisma.$queryRaw<[{ current_database: string }]>`SELECT current_database() as current_database`;
    dbCheck.database = db[0]?.current_database ?? undefined;
    const last = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    dbCheck.lastUserCreatedAt = last?.createdAt.toISOString();
  } catch (e) {
    dbCheck.error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    db: dbCheck,
    // Email verification (SendGrid)
    has_SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
    has_EMAIL_FROM: !!process.env.EMAIL_FROM,
    EMAIL_FROM: process.env.EMAIL_FROM ?? null,
    EMAIL_VERIFY_DISABLED: isEmailVerifyDisabled(),
  });
}
