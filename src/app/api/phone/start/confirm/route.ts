import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const phone = (body?.phone ?? "").toString().trim();
  const code = (body?.code ?? "").toString().trim();

  if (!phone) return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  if (!sid || !token || !service) return NextResponse.json({ error: "Server missing Twilio env vars" }, { status: 500 });

  const client = twilio(sid, token);

  const check = await client.verify.v2.services(service).verificationChecks.create({
    to: phone,
    code,
  });

  if (check.status !== "approved") {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Store verified phone on user (unique across accounts)
  // If another user already has this phone, block it.
  const existing = await prisma.user.findFirst({
    where: { phoneE164: phone },
    select: { id: true },
  });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ error: "That phone number is already in use." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phoneE164: phone, phoneVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
