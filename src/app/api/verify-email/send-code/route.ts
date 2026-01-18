import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function code6() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 100000-999999
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();

  if (!email) return bad("Email required");
  if (!isValidEmail(email)) return bad("Invalid email address");

  // Prevent email reuse across users
  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing && existing.id !== userId) return bad("That email is already in use.", 409);

  // Basic resend cooldown (60s)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifySentAt: true },
  });
  if (me?.emailVerifySentAt) {
    const ms = Date.now() - me.emailVerifySentAt.getTime();
    if (ms < 60_000) return bad("Please wait a minute before requesting a new code.", 429);
  }

  const code = code6();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      emailVerifiedAt: null,
      emailVerifyCodeHash: hashCode(code),
      emailVerifyExpiresAt: expiresAt,
      emailVerifySentAt: new Date(),
      emailVerifyAttempts: 0,
    },
  });

  if (!process.env.EMAIL_FROM) return bad("Server missing EMAIL_FROM", 500);

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Regaged verification code",
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <h2>Regaged Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 4px;">${code}</div>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn’t request this, ignore this email.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
