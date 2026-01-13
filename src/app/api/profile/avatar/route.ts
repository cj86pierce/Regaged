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

  const s = (k: string, def: string) => (typeof body[k] === "string" ? body[k] : def);

  await prisma.user.update({
    where: { id: userId },
    data: {
      bodyStyle: s("bodyStyle", "body_m"),
      hairStyle: s("hairStyle", "hair_m_01"),
      eyesStyle: s("eyesStyle", "eyes_01"),
      mouthStyle: s("mouthStyle", "mouth_01"),
      shirtStyle: s("shirtStyle", "shirt_01"),

      bodyColor: s("bodyColor", "#F1C27D"),
      hairColor: s("hairColor", "#2B1B0E"),
      eyeColor: s("eyeColor", "#2E7DFF"),
      shirtColor: s("shirtColor", "#E53935"),

      // NEW (you already have mouth grey, so tintable)
      // Add this field to schema if not present:
      mouthColor: s("mouthColor", "#E0AC69"),

      // NEW fields you added:
      accessoryStyle: s("accessoryStyle", "none"),
      accessoryColor: s("accessoryColor", "#111111"),
    } as any,
  });

  return NextResponse.json({ ok: true });
}
