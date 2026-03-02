import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function GET() {
  const designs = await prisma.design.findMany({
    include: {
      user: { select: { username: true } },
      _count: { select: { votes: true } },
    },
  });

  const mapped = designs.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    authorUsername: d.user.username,
    createdAt: d.createdAt.toISOString(),
    voteCount: d._count.votes,
  }));

  const recent = [...mapped].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const top = [...mapped].sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
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

  const title = (typeof titleRaw === "string" ? titleRaw : "").trim();
  const description = (typeof descriptionRaw === "string" ? descriptionRaw : "").trim();

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
      image: buffer,
      contentType: file.type || "image/png",
    },
  });

  return NextResponse.json({ ok: true, id: design.id });
}

