import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const gameId = params.id;

  const body = await req.json().catch(() => null);
  const eventId = (body?.eventId ?? "").toString().trim();
  const slotIndex = Number(body?.slotIndex);

  if (!eventId) return bad("eventId required");
  if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 4) return bad("slotIndex must be 0..4");

  // must be active in game
  const gp = await prisma.gamePlayer.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { status: true, health: true, keys: true },
  });
  if (!gp || gp.status !== "ACTIVE") return bad("Not in this game", 403);

  // lock per event so only one claim wins
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${eventId})) as locked
  `;
  if (!lockRows?.[0]?.locked) return bad("Try again", 409);

  try {
    const ev = await prisma.castingDropEvent.findUnique({
      where: { id: eventId },
      include: { options: true },
    });
    if (!ev || ev.gameId !== gameId) return bad("Drop not found", 404);
    if (ev.claimedAt) return bad("Already claimed", 409);

    if (ev.dropType === "CARE_PACKAGE") {
      if (ev.recipientUserId !== userId) return bad("This care package is not for you", 403);
    }

    const opt = ev.options.find((o) => o.slotIndex === slotIndex);
    if (!opt) return bad("Invalid choice");

    const now = new Date();

    // apply result
    let deltaHp = 0;
    let deltaKeys = 0;
    if (opt.kind === "APPLE") deltaHp = +15;
    if (opt.kind === "POISON") deltaHp = -15;
    if (opt.kind === "KEY") deltaKeys = +1;

    const newHealth = Math.max(0, Math.min(100, (gp.health ?? 70) + deltaHp));
    const newKeys = (gp.keys ?? 0) + deltaKeys;

    await prisma.$transaction(async (tx) => {
      // mark claimed
      await tx.castingDropEvent.update({
        where: { id: eventId },
        data: { claimedByUserId: userId, claimedAt: now },
      });

      // update player stats
      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId } },
        data: {
          health: newHealth,
          keys: newKeys,
          lastActiveAt: now,
        },
      });

      if (newHealth <= 0) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId } },
          data: { status: "ELIMINATED", eliminatedAt: now },
        });
      }

      if (ev.messageId) {
        await tx.gameMessage.delete({ where: { id: ev.messageId } }).catch(() => {});
      }
    });

    return NextResponse.json({ ok: true, result: opt.kind, deltaHp, deltaKeys, newHealth, newKeys });
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${eventId}))`;
  }
}
