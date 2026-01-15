import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bio = (body?.bio ?? "").toString();

  // keep it reasonable (Tengaged-ish)
  const trimmed = bio.slice(0, 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { bio: trimmed },
  });

  return NextResponse.json({ ok: true });
}
