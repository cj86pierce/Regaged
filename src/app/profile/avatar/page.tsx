export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import AvatarEditor from "./ui/AvatarEditor";
import type { AvatarConfig } from "@/components/Avatar";
import { getSlotDesignsForUser } from "@/lib/avatarSlotDesigns";

type Initial = AvatarConfig & { username: string };

function oneOf(v: string, allowed: string[], fallback: string) {
  return allowed.includes(v) ? v : fallback;
}

export default async function AvatarPage() {
  const userId = await getCurrentUserIdFromHeaders();

  if (!userId) {
    return <main style={{ padding: 12 }}>You must be logged in.</main>;
  }

  const [u, slotDesigns] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        bodyStyle: true,
        hairStyle: true,
        eyesStyle: true,
        mouthStyle: true,
        shirtStyle: true,
        accessoryStyle: true,
        bodyColor: true,
        hairColor: true,
        eyeColor: true,
        mouthColor: true,
        shirtColor: true,
        accessoryColor: true,
      },
    }),
    getSlotDesignsForUser(userId),
  ]);

  if (!u) return <main style={{ padding: 12 }}>User not found.</main>;

  // ✅ sanitize to known option sets so types + runtime are both safe
  const initial: Initial = {
    username: u.username,

    bodyStyle: oneOf(u.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(
      u.hairStyle,
      ["hair_m_01", "hair_m_02", "hair_m_03", "hair_f_01", "hair_f_02", "hair_f_03"],
      "hair_m_01"
    ),
    eyesStyle: oneOf(u.eyesStyle, ["eyes_01", "eyes_02", "eyes_03", "eyes_04", "eyes_05", "eyes_06"], "eyes_01"),
    mouthStyle: oneOf(u.mouthStyle, ["mouth_01", "mouth_02", "mouth_03", "mouth_04", "mouth_05", "mouth_06"], "mouth_01"),
    shirtStyle: oneOf(u.shirtStyle, ["shirt_01", "shirt_02", "shirt_03", "shirt_04", "shirt_05", "shirt_06"], "shirt_01"),
    accessoryStyle: oneOf(u.accessoryStyle, ["none", "accessory_01"], "none"),
    glassesStyle: "none",
    scarStyle: "none",
    hairOrnamentStyle: "none",

    bodyColor: u.bodyColor,
    hairColor: u.hairColor,
    eyeColor: u.eyeColor,
    mouthColor: u.mouthColor,
    shirtColor: u.shirtColor,
    accessoryColor: u.accessoryColor,
    backgroundColor: "#E8E8E8",
    glassesColor: "#111111",
    scarColor: "#8B4513",
    hairOrnamentColor: "#C0C0C0",
  };

  return <AvatarEditor initial={initial} slotDesigns={slotDesigns} />;
}
