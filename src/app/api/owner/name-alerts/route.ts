import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { maybeAlertSimilarUsernames, similarUsernameReason } from "@/lib/similarUsernames";
import { isStaffUsername } from "@/lib/usernames";

export async function GET(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const alerts = await prisma.similarNameAlert.findMany({
    where: { dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
      a: { id: a.userAId, username: a.usernameA },
      b: { id: a.userBId, username: a.usernameB },
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "dismiss") {
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.similarNameAlert.updateMany({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "scan") {
    // One-shot pass over recent non-bot players to surface existing lookalikes
    const recent = await prisma.user.findMany({
      where: {
        isOwner: false,
        isAdmin: false,
        bannedAt: null,
        NOT: [{ usernameLower: { startsWith: "bot_" } }, { usernameLower: { startsWith: "__" } }],
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, username: true, usernameLower: true, email: true },
    });

    const players = recent.filter(
      (u) => !u.email?.endsWith("@regaged.bot") && !isStaffUsername(u.usernameLower)
    );

    let created = 0;
    for (let i = 0; i < players.length; i++) {
      const a = players[i]!;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j]!;
        const reason = similarUsernameReason(a.username, b.username);
        if (!reason) continue;
        const [userA, userB] = a.id < b.id ? [a, b] : [b, a];
        try {
          await prisma.similarNameAlert.create({
            data: {
              userAId: userA.id,
              userBId: userB.id,
              usernameA: userA.username,
              usernameB: userB.username,
              reason,
            },
          });
          created++;
        } catch {
          // already exists
        }
      }
    }

    // Also re-check newest accounts against the wider pool via helper
    for (const u of players.slice(0, 40)) {
      created += await maybeAlertSimilarUsernames(u);
    }

    return NextResponse.json({ ok: true, created });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
