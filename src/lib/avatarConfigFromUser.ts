import type { AvatarConfig } from "@/components/Avatar";

function oneOf(v: string, allowed: string[], fallback: string) {
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
    bodyStyle: oneOf(user.bodyStyle, ["body_m", "body_f"], "body_m") as "body_m" | "body_f",
    hairStyle: oneOf(user.hairStyle, ["hair_m_01", "hair_m_02", "hair_m_03", "hair_f_01", "hair_f_02", "hair_f_03"], "hair_m_01"),
    eyesStyle: oneOf(user.eyesStyle, ["eyes_01", "eyes_02", "eyes_03", "eyes_04", "eyes_05", "eyes_06"], "eyes_01"),
    mouthStyle: oneOf(user.mouthStyle, ["mouth_01", "mouth_02", "mouth_03", "mouth_04", "mouth_05", "mouth_06"], "mouth_01"),
    shirtStyle: oneOf(user.shirtStyle, ["shirt_01", "shirt_02", "shirt_03", "shirt_04", "shirt_05", "shirt_06"], "shirt_01"),
    accessoryStyle: oneOf(user.accessoryStyle, ["none", "accessory_01"], "none"),
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
