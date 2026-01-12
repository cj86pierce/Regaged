import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const usernameRaw = (body?.username ?? "").toString().trim().toLowerCase();
  const password = (body?.password ?? "").toString();

  if (usernameRaw.length < 3 || usernameRaw.length > 20) {
    return NextResponse.json({ error: "Username must be 3–20 chars." }, { status: 400 });
  }
  if (!/^[a-z0-9_]+$/.test(usernameRaw)) {
    return NextResponse.json({ error: "Username can only use a-z, 0-9, underscore." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 chars." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: usernameRaw } });
  if (existing) return NextResponse.json({ error: "Username already taken." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  // Starter balances: tweak anytime
  const user = await prisma.user.create({
    data: {
      username: usernameRaw,
      passwordHash,
      karma: 0,
      tMoney: 50, // give some T$ so buying Yellow is possible soon
    },
    select: { id: true, username: true },
  });

  return NextResponse.json({ ok: true, user });
}
