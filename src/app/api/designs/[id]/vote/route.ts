import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { getUserColorStrength } from "@/lib/blogStrength";

const DESIGN_VOTING_MS = 60 * 1000; // 1 min for testing; 24*60*60*1000 for 1 day

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function votingEndsAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + DESIGN_VOTING_MS);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const designId = params.id;
  const body = await req.json().catch(() => null);
  const type = body?.type as "PLUS" | "MINUS";
  if (type !== "PLUS" && type !== "MINUS") return bad("Invalid type", 400);

  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true, userId: true, createdAt: true },
  });
  if (!design) return bad("Design not found", 404);
  if (design.userId === userId) return bad("Cannot vote on own design", 400);

  const endsAt = votingEndsAt(design.createdAt);
  if (new Date() >= endsAt) return bad("Voting closed for this design (voting window ended)", 400);

  const points = await getUserColorStrength(userId);

  const existing = await prisma.designVote.findUnique({
    where: { designId_userId: { designId, userId } },
    select: { id: true, type: true },
  });

  if (existing) {
    if (existing.type === type) return bad("Already voted", 400);
    await prisma.designVote.update({
      where: { designId_userId: { designId, userId } },
      data: { type, points },
    });
  } else {
    await prisma.designVote.create({
      data: { designId, userId, type, points },
    });
  }

  const votes = await prisma.designVote.findMany({ where: { designId } });
  const plus = votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
  const minus = votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);

  return NextResponse.json({
    ok: true,
    plus,
    minus,
    score: plus - minus,
    myVote: type,
  });
}
