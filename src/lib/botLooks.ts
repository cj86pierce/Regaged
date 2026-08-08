import {
  ACCESSORY_STYLES,
  BODY_STYLES,
  EYES_STYLES,
  HAIR_STYLES,
  MOUTH_STYLES,
  SHIRT_STYLES,
} from "@/lib/avatarStyles";

const SKIN = ["#F1C27D", "#E0AC69", "#C68642", "#8D5524", "#FFDBAC", "#D4A574"];
const HAIR = ["#2B1B0E", "#1a1a1a", "#4a3728", "#6B4423", "#C4A35A", "#8B4513", "#B55239", "#3d3d3d"];
const EYES = ["#2E7DFF", "#3d5a3d", "#5D4037", "#1565C0", "#6A1B9A", "#00838F", "#37474F"];
const SHIRTS = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FB8C00",
  "#8E24AA",
  "#00897B",
  "#5D4037",
  "#37474F",
  "#C0CA33",
  "#D81B60",
];
const BACKGROUNDS = ["#E8E8E8", "#FFF3E0", "#E3F2FD", "#E8F5E9", "#FCE4EC", "#F3E5F5", "#E0F7FA"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Random wearable look for a practice bot. */
export function randomBotAvatar() {
  const bodyStyle = pick(BODY_STYLES);
  const hairPool = HAIR_STYLES.filter((h) =>
    bodyStyle === "body_f" ? h.startsWith("hair_f_") : h.startsWith("hair_m_")
  );
  return {
    bodyStyle,
    hairStyle: pick(hairPool.length ? hairPool : HAIR_STYLES),
    eyesStyle: pick(EYES_STYLES),
    mouthStyle: pick(MOUTH_STYLES),
    shirtStyle: pick(SHIRT_STYLES),
    accessoryStyle: Math.random() < 0.55 ? pick(ACCESSORY_STYLES.filter((a) => a !== "none")) : "none",
    glassesStyle: "none",
    scarStyle: "none",
    hairOrnamentStyle: "none",
    bodyColor: pick(SKIN),
    hairColor: pick(HAIR),
    eyeColor: pick(EYES),
    mouthColor: "#E0AC69",
    shirtColor: pick(SHIRTS),
    accessoryColor: pick(["#111111", "#C0C0C0", "#FFD700", "#E53935", "#1E88E5"]),
    backgroundColor: pick(BACKGROUNDS),
    glassesColor: "#111111",
    scarColor: "#8B4513",
    hairOrnamentColor: "#C0C0C0",
  };
}
