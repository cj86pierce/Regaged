import { prisma } from "@/lib/prisma";

export async function getBlogPost(id: string, userId: string | null) {
  const post = await prisma.blogPost.findUnique({
    where: { id },
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
  if (!post) return null;

  const plus = post.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
  const minus = post.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
  const myPostVote = userId ? post.votes.find((v) => v.userId === userId)?.type ?? null : null;

  const comments = post.comments.map((c) => {
    const cPlus = c.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const cMinus = c.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    const myCommentVote = userId ? c.votes.find((v) => v.userId === userId)?.type ?? null : null;
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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const canVote = post.createdAt >= cutoff;

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    plus,
    minus,
    score: plus - minus,
    myVote: myPostVote,
    canVote,
    comments: comments.map((c) => ({ ...c, canVote })),
  };
}
