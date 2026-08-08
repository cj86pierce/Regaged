import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { isReservedUsername, reservedUsernameError } from "@/lib/usernames";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const newName = typeof body?.username === "string" ? body.username.trim() : "";
  if (newName.length < 2 || newName.length > 20) {
    return NextResponse.json({ error: "Username must be 2–20 characters" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_]+$/.test(newName)) {
    return NextResponse.json({ error: "Letters, numbers, underscore only" }, { status: 400 });
  }
  if (isReservedUsername(newName)) {
    return NextResponse.json({ error: reservedUsernameError() }, { status: 400 });
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, usernameLower: true, usernameChangedAt: true },
  });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newLower = newName.toLowerCase();
  if (newLower === me.usernameLower) {
    return NextResponse.json({ ok: true, username: me.username });
  }

  if (me.usernameChangedAt) {
    const next = me.usernameChangedAt.getTime() + YEAR_MS;
    if (Date.now() < next) {
      const days = Math.ceil((next - Date.now()) / (24 * 60 * 60 * 1000));
      return NextResponse.json(
        { error: `You can change your username once per year. Try again in ~${days} days.` },
        { status: 429 }
      );
    }
  }

  const taken = await prisma.user.findUnique({
    where: { usernameLower: newLower },
    select: { id: true },
  });
  if (taken) return NextResponse.json({ error: "Username taken" }, { status: 409 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      username: newName,
      usernameLower: newLower,
      usernameChangedAt: new Date(),
    },
    select: { username: true, usernameChangedAt: true },
  });

  return NextResponse.json({
    ok: true,
    username: updated.username,
    usernameChangedAt: updated.usernameChangedAt?.toISOString() ?? null,
  });
}
