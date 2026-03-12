import { prisma } from "@/lib/prisma";

// Testing: 1 minute. For production set to 24*60*60*1000 (1 day).
const DESIGN_VOTING_MS = 60 * 1000;

function votingEndsAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + DESIGN_VOTING_MS);
}

export async function getDesign(designId: string, userId: string | null) {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      user: { select: { id: true, username: true } },
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
  if (!design) return null;

  const plus = design.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
  const minus = design.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
  const myVote = userId ? design.votes.find((v) => v.userId === userId)?.type ?? null : null;
  const endsAt = votingEndsAt(design.createdAt);
  const canVote = endsAt > new Date();

  const comments = design.comments.map((c) => {
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

  return {
    id: design.id,
    title: design.title,
    description: design.description,
    designType: design.designType,
    author: design.user,
    createdAt: design.createdAt.toISOString(),
    votingEndsAt: endsAt.toISOString(),
    plus,
    minus,
    score: plus - minus,
    myVote,
    canVote,
    comments: comments.map((c) => ({ ...c, canVote })),
  };
}
