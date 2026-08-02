import type { AvatarConfig } from "@/components/Avatar";
import {
  ACCESSORY_STYLES,
  BODY_STYLES,
  EYES_STYLES,
  HAIR_STYLES,
  MOUTH_STYLES,
  SHIRT_STYLES,
} from "@/lib/avatarStyles";

function oneOf(v: string, allowed: readonly string[], fallback: string) {
  return allowed.includes(v) ? v : fallback;
}

type UserAvatarFields = {
  bodyStyle: string;
  hairStyle: string;
  eyesStyle: string;
  mouthStyle: string;
  shirtStyle: string;
  accessoryStyle: string;
  glassesStyle?: string;
  scarStyle?: string;
  hairOrnamentStyle?: string;
  bodyColor: string;
  hairColor: string;
  eyeColor: string;
  mouthColor: string;
  shirtColor: string;
  accessoryColor: string;
  backgroundColor?: string;
  glassesColor?: string;
  scarColor?: string;
  hairOrnamentColor?: string;
};

export function avatarConfigFromUser(user: UserAvatarFields): AvatarConfig {
  return {
    bodyStyle: oneOf(user.bodyStyle, BODY_STYLES, "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(user.hairStyle, HAIR_STYLES, "hair_m_01"),
    eyesStyle: oneOf(user.eyesStyle, EYES_STYLES, "eyes_01"),
    mouthStyle: oneOf(user.mouthStyle, MOUTH_STYLES, "mouth_01"),
    shirtStyle: oneOf(user.shirtStyle, SHIRT_STYLES, "shirt_01"),
    accessoryStyle: oneOf(user.accessoryStyle, ACCESSORY_STYLES, "none"),
    glassesStyle: oneOf(user.glassesStyle ?? "none", ["none"], "none"),
    scarStyle: oneOf(user.scarStyle ?? "none", ["none"], "none"),
    hairOrnamentStyle: oneOf(user.hairOrnamentStyle ?? "none", ["none"], "none"),
    bodyColor: user.bodyColor,
    hairColor: user.hairColor,
    eyeColor: user.eyeColor,
    mouthColor: user.mouthColor,
    shirtColor: user.shirtColor,
    accessoryColor: user.accessoryColor,
    backgroundColor: user.backgroundColor ?? "#E8E8E8",
    glassesColor: user.glassesColor ?? "#111111",
    scarColor: user.scarColor ?? "#8B4513",
    hairOrnamentColor: user.hairOrnamentColor ?? "#C0C0C0",
  };
}
