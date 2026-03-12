import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

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
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!content) return bad("Content required", 400);

  const design = await prisma.design.findUnique({ where: { id: designId }, select: { createdAt: true } });
  if (!design) return bad("Design not found", 404);

  const comment = await prisma.designComment.create({
    data: { designId, authorId: userId, content },
    include: { author: { select: { id: true, username: true } } },
  });

  const canVote = votingEndsAt(design.createdAt) > new Date();

  return NextResponse.json({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
    plus: 0,
    minus: 0,
    score: 0,
    myVote: null,
    canVote,
  });
}
