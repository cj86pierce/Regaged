import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { checkBlockedContent } from "@/lib/contentFilter";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const message = String(body?.message ?? body?.body ?? "").trim();

  if (name.length < 1) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Name too long (max 80)" }, { status: 400 });
  }
  if (message.length < 1) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message too long (max 4000)" }, { status: 400 });
  }

  const hit = checkBlockedContent(`${name}\n${message}`);
  if (hit) {
    return NextResponse.json({ error: "Message contains blocked language." }, { status: 400 });
  }

  const userId = (await getCurrentUserId(req)) ?? null;

  const created = await prisma.supportMessage.create({
    data: { name, body: message, userId },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
