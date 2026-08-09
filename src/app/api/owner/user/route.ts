import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { resolveStaffFlags } from "@/lib/staffAccess";

type Action =
  | "lookup"
  | "set_currencies"
  | "rename"
  | "warn"
  | "clear_warn"
  | "ban"
  | "unban";

const userSelect = {
  id: true,
  username: true,
  usernameLower: true,
  karma: true,
  tMoney: true,
  isOwner: true,
  isAdmin: true,
  bannedAt: true,
  banReason: true,
  warnedAt: true,
  lockedLoginIp: true,
} as const;

function clampInt(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const usernameRaw = typeof body?.username === "string" ? body.username.trim() : "";
  const action = (typeof body?.action === "string" ? body.action : "lookup") as Action;

  if (!usernameRaw) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const usernameLower = usernameRaw.toLowerCase();
  const target = await prisma.user.findUnique({
    where: { usernameLower },
    select: userSelect,
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "lookup") {
    return NextResponse.json({ user: serialize(target) });
  }

  if (action === "set_currencies") {
    const data: { karma?: number; tMoney?: number } = {};
    if (body.karma !== undefined) {
      const v = clampInt(body.karma, 0, 1_000_000_000);
      if (v == null) return NextResponse.json({ error: "Invalid karma" }, { status: 400 });
      data.karma = v;
    }
    if (body.tMoney !== undefined) {
      const v = clampInt(body.tMoney, 0, 1_000_000_000);
      if (v == null) return NextResponse.json({ error: "Invalid tMoney" }, { status: 400 });
      data.tMoney = v;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No currency fields" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: target.id },
      data,
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  if (action === "rename") {
    const newName = typeof body?.newUsername === "string" ? body.newUsername.trim() : "";
    if (newName.length < 2 || newName.length > 20) {
      return NextResponse.json({ error: "Username must be 2–20 characters" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_]+$/.test(newName)) {
      return NextResponse.json({ error: "Username: letters, numbers, underscore only" }, { status: 400 });
    }
    const newLower = newName.toLowerCase();
    const { isReservedUsername, reservedUsernameError } = await import("@/lib/usernames");
    if (isReservedUsername(newName)) {
      return NextResponse.json({ error: reservedUsernameError() }, { status: 400 });
    }
    if (newLower !== target.username.toLowerCase()) {
      const taken = await prisma.user.findUnique({
        where: { usernameLower: newLower },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { username: newName, usernameLower: newLower },
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  if (action === "warn") {
    if (resolveStaffFlags(target).isStaff) {
      return NextResponse.json({ error: "Cannot warn an owner/admin" }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { warnedAt: new Date() },
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  if (action === "clear_warn") {
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { warnedAt: null },
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  if (action === "ban") {
    if (resolveStaffFlags(target).isStaff) {
      return NextResponse.json({ error: "Cannot ban an owner/admin" }, { status: 400 });
    }
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : null;
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { bannedAt: new Date(), banReason: reason || "Banned by owner" },
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  if (action === "unban") {
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { bannedAt: null, banReason: null },
      select: userSelect,
    });
    return NextResponse.json({ user: serialize(updated) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

function serialize(u: {
  id: string;
  username: string;
  karma: number;
  tMoney: number;
  isOwner: boolean;
  isAdmin: boolean;
  usernameLower: string;
  bannedAt: Date | null;
  banReason: string | null;
  warnedAt: Date | null;
  lockedLoginIp: string | null;
}) {
  const staff = resolveStaffFlags(u);
  return {
    id: u.id,
    username: u.username,
    karma: u.karma,
    tMoney: u.tMoney,
    isOwner: staff.isOwner,
    isAdmin: staff.isAdmin,
    banned: !!u.bannedAt,
    banReason: u.banReason,
    warned: !!u.warnedAt,
    warnedAt: u.warnedAt?.toISOString() ?? null,
    lockedLoginIp: u.lockedLoginIp,
  };
}
