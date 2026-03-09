import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

const BLOG_FEED_DAYS = 3;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BLOG_FEED_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const [postsRaw, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true } },
        votes: true,
        _count: { select: { comments: true } },
      },
    }),
    prisma.blogPost.count({ where: { createdAt: { gte: cutoff } } }),
  ]);

  const posts = postsRaw.filter((p) => p.author != null);

  // Compute scores and sort by score desc for placement; then paginate
  const scored = posts.map((p) => {
    const plus = p.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const minus = p.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    return {
      ...p,
      plus,
      minus,
      score: plus - minus,
    };
  });
  scored.sort((a, b) => b.score - a.score);

  const paginated = scored.slice(skip, skip + pageSize);
  const items = paginated.map((p, i) => {
    const globalIndex = skip + i;
    const placement = globalIndex < 3 ? globalIndex + 1 : null;
    return {
      id: p.id,
      title: p.title,
      content: p.content,
      createdAt: p.createdAt.toISOString(),
      author: p.author,
      plus: p.plus,
      minus: p.minus,
      score: p.score,
      commentCount: p._count.comments,
      placement,
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 10000) : "";
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const post = await prisma.blogPost.create({
    data: { authorId: userId, title, content },
    include: { author: { select: { id: true, username: true } } },
  });

  return NextResponse.json({
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
  });
}
