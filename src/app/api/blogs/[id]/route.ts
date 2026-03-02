import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId(req);

  const post = await prisma.blogPost.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, username: true } },
      votes: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, username: true } },
          votes: true,
        },
      },
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const plus = post.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
  const minus = post.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);

  const myPostVote = userId
    ? post.votes.find((v) => v.userId === userId)?.type ?? null
    : null;

  const comments = post.comments.map((c) => {
    const cPlus = c.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const cMinus = c.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    const myCommentVote = userId
      ? c.votes.find((v) => v.userId === userId)?.type ?? null
      : null;
    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
      plus: cPlus,
      minus: cMinus,
      score: cPlus - cMinus,
      myVote: myCommentVote,
    };
  });

  return NextResponse.json({
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    plus,
    minus,
    score: plus - minus,
    myVote: myPostVote,
    comments,
  });
}
