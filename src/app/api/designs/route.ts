import { NextResponse } from "next/server";
import { DesignType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

const DESIGN_VOTING_DAYS = 2;

function votingEndsAt(createdAt: Date): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + DESIGN_VOTING_DAYS);
  return d;
}

export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  const designs = await prisma.design.findMany({
    include: {
      user: { select: { username: true } },
      votes: true,
      _count: { select: { comments: true } },
    },
  });

  const now = new Date();
  const mapped = designs.map((d) => {
    const plus = d.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const minus = d.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    const score = plus - minus;
    const endsAt = votingEndsAt(d.createdAt);
    const canVote = endsAt > now;
    const myVote = userId ? d.votes.find((v) => v.userId === userId)?.type ?? null : null;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      designType: d.designType,
      authorUsername: d.user.username,
      createdAt: d.createdAt.toISOString(),
      votingEndsAt: endsAt.toISOString(),
      plus,
      minus,
      score,
      commentCount: d._count.comments,
      canVote,
      myVote,
    };
  });

  const recent = [...mapped].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  // Top: only designs still in voting window (votingEndsAt > now); then by score
  const top = mapped
    .filter((d) => new Date(d.votingEndsAt) > now)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return NextResponse.json({ recent, top });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  const titleRaw = form.get("title");
  const descriptionRaw = form.get("description");
  const designTypeRaw = form.get("designType");

  const title = (typeof titleRaw === "string" ? titleRaw : "").trim();
  const description = (typeof descriptionRaw === "string" ? descriptionRaw : "").trim();
  const validTypes = ["BODY", "HAIR", "EYES", "MOUTH", "SHIRT", "ACCESSORY"] as const;
  const designTypeRawStr = typeof designTypeRaw === "string" ? designTypeRaw.toUpperCase() : "";
  if (!validTypes.includes(designTypeRawStr as (typeof validTypes)[number])) {
    return NextResponse.json({ error: "Design type is required (Body, Hair, Eyes, Mouth, Shirt, or Accessory)" }, { status: 400 });
  }
  const designType = designTypeRawStr as DesignType;

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PNG file is required" }, { status: 400 });
  }

  if (file.type !== "image/png") {
    return NextResponse.json({ error: "Only PNG uploads are allowed" }, { status: 400 });
  }

  const maxBytes = 512 * 1024; // 512 KB safety cap
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return NextResponse.json({ error: "Image too large (max 512KB)" }, { status: 400 });
  }

  const buffer = Buffer.from(arrayBuffer);

  const design = await prisma.design.create({
    data: {
      userId,
      title,
      description,
      designType,
      image: buffer,
      contentType: file.type || "image/png",
    },
  });

  return NextResponse.json({ ok: true, id: design.id });
}
