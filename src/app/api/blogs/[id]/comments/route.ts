import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId(req);
  if (!userId) return bad("Unauthorized", 401);

  const postId = params.id;
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
  if (!content) return bad("Content required", 400);

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return bad("Post not found", 404);

  const comment = await prisma.blogComment.create({
    data: { postId, authorId: userId, content },
    include: { author: { select: { id: true, username: true } } },
  });

  return NextResponse.json({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
    plus: 0,
    minus: 0,
    score: 0,
  });
}
