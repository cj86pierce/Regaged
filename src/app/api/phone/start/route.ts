import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import twilio from "twilio";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const phone = (body?.phone ?? "").toString().trim();
  if (!phone) return NextResponse.json({ error: "Phone number required" }, { status: 400 });

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  if (!sid || !token || !service) return NextResponse.json({ error: "Server missing Twilio env vars" }, { status: 500 });

  const client = twilio(sid, token);

  // Twilio expects E.164 (example: +14195551234)
  await client.verify.v2.services(service).verifications.create({
    to: phone,
    channel: "sms",
  });

  return NextResponse.json({ ok: true });
}
