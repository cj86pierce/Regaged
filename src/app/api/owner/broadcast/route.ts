import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { humanUserWhere } from "@/lib/onlineUsers";
import { sendEmailBlast } from "@/lib/sendEmail";

export const dynamic = "force-dynamic";

/** GET — count verified recipients. POST — send subject/body to all verified emails. */
export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const count = await prisma.user.count({
    where: {
      emailVerifiedAt: { not: null },
      email: { not: null },
      ...humanUserWhere(),
    },
  });

  return NextResponse.json({ verifiedRecipients: count });
}

export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? "").trim();
  const text = String(body?.text ?? body?.message ?? "").trim();

  if (subject.length < 1) {
    return NextResponse.json({ error: "Subject required" }, { status: 400 });
  }
  if (subject.length > 200) {
    return NextResponse.json({ error: "Subject too long (max 200)" }, { status: 400 });
  }
  if (text.length < 1) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Message too long (max 8000)" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: {
      emailVerifiedAt: { not: null },
      email: { not: null },
      ...humanUserWhere(),
    },
    select: { email: true },
  });

  const recipients = [
    ...new Set(
      users
        .map((u) => (u.email ?? "").trim().toLowerCase())
        .filter((e) => e && !e.endsWith("@regaged.bot"))
    ),
  ];

  if (!recipients.length) {
    return NextResponse.json({ error: "No verified email recipients found." }, { status: 400 });
  }

  const result = await sendEmailBlast({
    recipients,
    subject,
    text,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, sent: result.sent, failed: result.failed },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
    recipients: recipients.length,
  });
}
