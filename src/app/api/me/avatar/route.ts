import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { avatarConfigFromUser } from "@/lib/avatarConfigFromUser";

/**
 * GET /api/me/avatar
 * Returns current user's avatar config for design preview etc.
 */
export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bodyStyle: true,
      hairStyle: true,
      eyesStyle: true,
      mouthStyle: true,
      shirtStyle: true,
      accessoryStyle: true,
      glassesStyle: true,
      scarStyle: true,
      hairOrnamentStyle: true,
      bodyColor: true,
      hairColor: true,
      eyeColor: true,
      mouthColor: true,
      shirtColor: true,
      accessoryColor: true,
      backgroundColor: true,
      glassesColor: true,
      scarColor: true,
      hairOrnamentColor: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const avatar = avatarConfigFromUser(user);
  return NextResponse.json({ avatar });
}
