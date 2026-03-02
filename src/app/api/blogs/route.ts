import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      include: {
        author: { select: { id: true, username: true } },
        votes: true,
        _count: { select: { comments: true } },
      },
    }),
    prisma.blogPost.count(),
  ]);

  const items = posts.map((p) => {
    const plus = p.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const minus = p.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    return {
      id: p.id,
      title: p.title,
      content: p.content,
      createdAt: p.createdAt.toISOString(),
      author: p.author,
      plus,
      minus,
      score: plus - minus,
      commentCount: p._count.comments,
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
