import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { checkBlockedContent } from "@/lib/contentFilter";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bio = (body?.bio ?? "").toString();

  const hit = checkBlockedContent(bio);
  if (hit) {
    return NextResponse.json({ error: "Bio contains blocked language." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { bio: bio.slice(0, 1000) },
  });

  return NextResponse.json({ ok: true });
}
