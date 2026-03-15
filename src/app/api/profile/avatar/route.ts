import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
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
      accessoryStyle: s("accessoryStyle", "none"),
      bodyColor: s("bodyColor", "#F1C27D"),
      hairColor: s("hairColor", "#2B1B0E"),
      eyeColor: s("eyeColor", "#2E7DFF"),
      mouthColor: s("mouthColor", "#E0AC69"),
      shirtColor: s("shirtColor", "#E53935"),
      accessoryColor: s("accessoryColor", "#111111"),
    } as Record<string, string>,
  });

  return NextResponse.json({ ok: true });
}
