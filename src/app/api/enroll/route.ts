import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { tryStartFastingGame } from "@/lib/gameEngine";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.enrollment.findUnique({
    where: { userId_gameType: { userId, gameType: "FASTING" } },
  });
  if (existing) return NextResponse.json({ error: "Already enrolled." }, { status: 400 });

  await prisma.enrollment.create({
    data: { userId, gameType: "FASTING" },
  });

  await tryStartFastingGame();

  return NextResponse.json({ ok: true });
}
