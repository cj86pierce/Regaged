/** Built-in avatar style ids (must match files under public/avatars/). */

export const BODY_STYLES = ["body_m", "body_f"] as const;

export const HAIR_STYLES = [
  "hair_m_01",
  "hair_m_02",
  "hair_m_03",
  "hair_m_04",
  "hair_m_05",
  "hair_m_06",
  "hair_f_01",
  "hair_f_02",
  "hair_f_03",
  "hair_f_04",
  "hair_f_05",
  "hair_f_06",
] as const;

export const EYES_STYLES = [
  "eyes_01",
  "eyes_02",
  "eyes_03",
  "eyes_04",
  "eyes_05",
  "eyes_06",
  "eyes_07",
  "eyes_08",
  "eyes_09",
  "eyes_10",
  "eyes_11",
  "eyes_12",
] as const;

export const MOUTH_STYLES = [
  "mouth_01",
  "mouth_02",
  "mouth_03",
  "mouth_04",
  "mouth_05",
  "mouth_06",
  "mouth_07",
  "mouth_08",
  "mouth_09",
  "mouth_10",
  "mouth_11",
  "mouth_12",
] as const;

export const SHIRT_STYLES = [
  "shirt_01",
  "shirt_02",
  "shirt_03",
  "shirt_04",
  "shirt_05",
  "shirt_06",
  "shirt_07",
  "shirt_08",
  "shirt_09",
  "shirt_10",
  "shirt_11",
  "shirt_12",
  "shirt_13",
  "shirt_14",
  "shirt_15",
  "shirt_16",
] as const;

export const ACCESSORY_STYLES = [
  "none",
  "accessory_01",
  "accessory_02",
  "accessory_03",
  "accessory_04",
  "accessory_05",
  "accessory_06",
  "accessory_07",
  "accessory_08",
] as const;

export type BodyStyle = (typeof BODY_STYLES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type EyesStyle = (typeof EYES_STYLES)[number];
export type MouthStyle = (typeof MOUTH_STYLES)[number];
export type ShirtStyle = (typeof SHIRT_STYLES)[number];
export type AccessoryStyle = (typeof ACCESSORY_STYLES)[number];

/** Human-readable labels for the avatar editor dropdowns. */
export const STYLE_LABELS: Record<string, string> = {
  // Body
  body_m: "Male",
  body_f: "Female",

  // Hair
  hair_m_01: "Side Sweep",
  hair_m_02: "Short Messy",
  hair_m_03: "Side Part",
  hair_m_04: "Spiky",
  hair_m_05: "Buzz Cut",
  hair_m_06: "Pompadour",
  hair_f_01: "Long Straight",
  hair_f_02: "Long Side",
  hair_f_03: "Long Layers",
  hair_f_04: "Top Bun",
  hair_f_05: "Bob",
  hair_f_06: "Pigtails",

  // Eyes
  eyes_01: "Dots",
  eyes_02: "Round",
  eyes_03: "Soft Round",
  eyes_04: "Soft Dots",
  eyes_05: "Squint",
  eyes_06: "Wide Line",
  eyes_07: "Sleepy",
  eyes_08: "Wide",
  eyes_09: "Almond",
  eyes_10: "Happy",
  eyes_11: "Wink",
  eyes_12: "Side Glance",

  // Mouth
  mouth_01: "Smile",
  mouth_02: "Flat",
  mouth_03: "Soft Smile",
  mouth_04: "Open Smile",
  mouth_05: "Big Smile",
  mouth_06: "Small Frown",
  mouth_07: "Grin",
  mouth_08: "Surprise",
  mouth_09: "Smirk",
  mouth_10: "Frown",
  mouth_11: "Tongue Out",
  mouth_12: "Pout",

  // Shirts
  shirt_01: "Suit & Tie",
  shirt_02: "Jersey",
  shirt_03: "T-Shirt",
  shirt_04: "Long Sleeve",
  shirt_05: "Crop Top",
  shirt_06: "Sleeveless",
  shirt_07: "Turtleneck",
  shirt_08: "Hoodie",
  shirt_09: "Tank Top",
  shirt_10: "Striped Tee",
  shirt_11: "V-Neck",
  shirt_12: "Button-Up",
  shirt_13: "Polo",
  shirt_14: "Star Tee",
  shirt_15: "Zip Jacket",
  shirt_16: "Overalls",

  // Accessories
  none: "None",
  accessory_01: "Visor",
  accessory_02: "Necklace",
  accessory_03: "Headphones",
  accessory_04: "Bow Tie",
  accessory_05: "Earrings",
  accessory_06: "Scarf",
  accessory_07: "Choker",
  accessory_08: "Cap",
};

export function styleLabel(id: string): string {
  return STYLE_LABELS[id] ?? id;
}
