import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";

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
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) return bad("Server missing SENDGRID_API_KEY", 500);
  if (!from) return bad("Server missing EMAIL_FROM", 500);

  sgMail.setApiKey(apiKey);

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

  // Cooldown (60s)
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

  // Store code hash + expiry
  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      emailVerifiedAt: null, // ✅ sending a code never verifies
      emailVerifyCodeHash: hashCode(code),
      emailVerifyExpiresAt: expiresAt,
      emailVerifySentAt: new Date(),
      emailVerifyAttempts: 0,
    },
  });

  // Send email (HARD FAIL if it errors)
  try {
    await sgMail.send({
      to: email,
      from,
      subject: "Your Regaged verification code",
      text: `Your Regaged verification code is: ${code}\n\nThis code expires in 10 minutes.`,
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
  } catch (err: any) {
    const body = err?.response?.body;
    const status = err?.response?.statusCode;
    console.error("SendGrid send failed:", body ?? err);

    // Surface common SendGrid issues to help admins debug
    let hint = "Email send failed. Try again in a minute.";
    if (body?.errors?.[0]?.message) {
      const msg = String(body.errors[0].message).toLowerCase();
      if (msg.includes("verified") || msg.includes("sender identity")) {
        hint = "Sender not verified. In SendGrid, verify EMAIL_FROM as Single Sender or Domain.";
      } else if (msg.includes("api key") || msg.includes("unauthorized") || status === 401) {
        hint = "Invalid SendGrid API key. Check SENDGRID_API_KEY.";
      } else if (msg.includes("from") || msg.includes("sender")) {
        hint = "Check EMAIL_FROM matches a verified sender in SendGrid.";
      }
    } else if (status === 401) {
      hint = "Invalid SendGrid API key. Check SENDGRID_API_KEY.";
    } else if (status === 403) {
      hint = "SendGrid rejected. Verify EMAIL_FROM in SendGrid dashboard.";
    }

    return bad(hint, 502);
  }

  return NextResponse.json({ ok: true });
}
