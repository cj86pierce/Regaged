import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { getUserColorStrength } from "@/lib/blogStrength";
import { grantBlogR$ } from "@/lib/blogR$";

const DESIGN_VOTING_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  const commentId = params.id;
  const body = await req.json().catch(() => null);
  const type = body?.type as "PLUS" | "MINUS";
  if (type !== "PLUS" && type !== "MINUS") return bad("Invalid type", 400);

  const comment = await prisma.designComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, design: { select: { createdAt: true } } },
  });
  if (!comment) return bad("Comment not found", 404);
  if (comment.authorId === userId) return bad("Cannot vote on own comment", 400);

  const endsAt = votingEndsAt(comment.design.createdAt);
  if (new Date() >= endsAt) return bad("Voting closed (design voting window ended)", 400);

  const points = await getUserColorStrength(userId);

  const existing = await prisma.designCommentVote.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true, type: true },
  });

  if (existing) {
    if (existing.type === type) return bad("Already voted", 400);
    await prisma.designCommentVote.update({
      where: { commentId_userId: { commentId, userId } },
      data: { type, points },
    });
  } else {
    await prisma.designCommentVote.create({
      data: { commentId, userId, type, points },
    });
  }

  const votes = await prisma.designCommentVote.findMany({ where: { commentId } });
  const plus = votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
  const minus = votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);

  if (type === "PLUS") {
    await grantBlogR$(comment.authorId, points);
  }

  return NextResponse.json({
    ok: true,
    plus,
    minus,
    score: plus - minus,
    myVote: type,
  });
}
