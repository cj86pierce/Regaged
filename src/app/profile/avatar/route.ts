import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const pick = (k: string, def: string) => (typeof body[k] === "string" ? body[k] : def);

  await prisma.user.update({
    where: { id: userId },
    data: {
      bodyStyle: pick("bodyStyle", "body1"),
      hairStyle: pick("hairStyle", "hair1"),
      eyesStyle: pick("eyesStyle", "eyes1"),
      mouthStyle: pick("mouthStyle", "mouth1"),
      shirtStyle: pick("shirtStyle", "shirt1"),

      bodyColor: pick("bodyColor", "#F1C27D"),
      hairColor: pick("hairColor", "#2B1B0E"),
      eyeColor: pick("eyeColor", "#2E7DFF"),
      shirtColor: pick("shirtColor", "#E53935"),
    },
  });

  return NextResponse.json({ ok: true });
}
