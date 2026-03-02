import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const designId = params.id;

  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { id: true },
  });
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });

  try {
    await prisma.designVote.create({
      data: { designId, userId },
    });
  } catch {
    // unique constraint -> already voted; treat as success
  }

  const votes = await prisma.designVote.count({ where: { designId } });
  return NextResponse.json({ ok: true, votes });
}

