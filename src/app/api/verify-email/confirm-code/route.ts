import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const code = (body?.code ?? "").toString().trim();

  if (!/^\d{6}$/.test(code)) return bad("Enter the 6-digit code.");

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerifiedAt: true,
      emailVerifyCodeHash: true,
      emailVerifyExpiresAt: true,
      emailVerifyAttempts: true,
    },
  });

  if (!me?.email) return bad("No email set. Request a code first.", 400);
  if (me.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  if (!me.emailVerifyCodeHash || !me.emailVerifyExpiresAt) {
    return bad("No active verification code. Request a new one.", 400);
  }

  if (Date.now() > me.emailVerifyExpiresAt.getTime()) {
    return bad("Code expired. Request a new one.", 400);
  }

  if ((me.emailVerifyAttempts ?? 0) >= 8) {
    return bad("Too many attempts. Request a new code.", 429);
  }

  const ok = hashCode(code) === me.emailVerifyCodeHash;

  if (!ok) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifyAttempts: { increment: 1 } },
    });
    return bad("Incorrect code.", 400);
  }

  // ✅ ONLY HERE do we mark verified
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyCodeHash: null,
      emailVerifyExpiresAt: null,
      emailVerifyAttempts: 0,
    },
  });

  return NextResponse.json({ ok: true });
}
