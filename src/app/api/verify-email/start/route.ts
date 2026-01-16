import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return bad("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();

  if (!email) return bad("Email required");
  if (!isValidEmail(email)) return bad("Invalid email");

  // Ensure no other user already owns this email
  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing && existing.id !== userId) return bad("That email is already in use.", 409);

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      emailVerifyToken: token,
      emailVerifySentAt: new Date(),
      emailVerifiedAt: null,
    },
  });

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${base}/verify-email/${token}`;

  // ✅ Beta mode: return + log link (no email provider required yet)
  console.log("VERIFY EMAIL LINK:", link);

  return NextResponse.json({ ok: true, link });
}
