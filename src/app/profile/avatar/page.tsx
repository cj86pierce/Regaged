export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import AvatarEditor from "./ui/AvatarEditor";
import type { AvatarConfig } from "@/components/Avatar";
import { getSlotDesignsForUser } from "@/lib/avatarSlotDesigns";
import {
  ACCESSORY_STYLES,
  BODY_STYLES,
  EYES_STYLES,
  HAIR_STYLES,
  MOUTH_STYLES,
  SHIRT_STYLES,
} from "@/lib/avatarStyles";

type Initial = AvatarConfig & { username: string };

function oneOf(v: string, allowed: readonly string[], fallback: string) {
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
    }),
    getSlotDesignsForUser(userId),
  ]);

  if (!u) return <main style={{ padding: 12 }}>User not found.</main>;

  // ✅ sanitize to known option sets so types + runtime are both safe
  const initial: Initial = {
    username: u.username,

    bodyStyle: oneOf(u.bodyStyle, BODY_STYLES, "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(u.hairStyle, HAIR_STYLES, "hair_m_01"),
    eyesStyle: oneOf(u.eyesStyle, EYES_STYLES, "eyes_01"),
    mouthStyle: oneOf(u.mouthStyle, MOUTH_STYLES, "mouth_01"),
    shirtStyle: oneOf(u.shirtStyle, SHIRT_STYLES, "shirt_01"),
    accessoryStyle: oneOf(u.accessoryStyle, ACCESSORY_STYLES, "none"),
    glassesStyle: u.glassesStyle ?? "none",
    scarStyle: u.scarStyle ?? "none",
    hairOrnamentStyle: u.hairOrnamentStyle ?? "none",

    bodyColor: u.bodyColor,
    hairColor: u.hairColor,
    eyeColor: u.eyeColor,
    mouthColor: u.mouthColor,
    shirtColor: u.shirtColor,
    accessoryColor: u.accessoryColor,
    backgroundColor: u.backgroundColor ?? "#E8E8E8",
    glassesColor: u.glassesColor ?? "#111111",
    scarColor: u.scarColor ?? "#8B4513",
    hairOrnamentColor: u.hairOrnamentColor ?? "#C0C0C0",
  };

  return <AvatarEditor initial={initial} slotDesigns={slotDesigns} />;
}
