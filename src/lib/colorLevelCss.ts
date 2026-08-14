import { COLOR_CATALOG } from "@/lib/colorCatalog";

/** Display swatches for color levels (username belt, shop, color lab). */
const SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#feff60",
  orange: "#ffbd40",
  "light green": "#71de72",
  green: "#4e622b",
  blue: "#246cec",
  purple: "#a146ce",
  red: "#ff1717",
  brown: "#8e4d1c",
  black: "#111111",
  silver: "#c0c0c0",
  gold: "#ffd700",
  sky: "#4fc3f7",
  blood: "#8b0000",
  "ultra gold": "#ffc107",
  titanium: "#cfd8dc",
  chroma: "#e040fb",
  holofoil: "#80d8ff",
  crystal: "#ff80ab",
  "tv star": "#ff66cc",
  "ugly olive": "#556b2f",
};

const ANIMATED = new Set(COLOR_CATALOG.filter((c) => c.isAnimated).map((c) => c.name.toLowerCase()));

export type ColorLabEntry = {
  name: string;
  animated: boolean;
  group: "static" | "moving";
  note: string;
  karmaNeeded?: number;
  priceT?: number;
  strength?: number;
};

const NOTES: Record<string, string> = {
  White: "Default",
  Silver: "Chrome dual gleam",
  Gold: "Warm luxury shimmer",
  Sky: "Sky-blue sweep bar",
  Blood: "Crimson sweep bar",
  "Ultra Gold": "Heavier gold flare",
  Titanium: "Cold white chrome",
  Chroma: "Pink-violet moving bar",
  Holofoil: "Iridescent oil-slick",
  Crystal: "Pink-white glow",
  "TV Star": "Top — rainbow + glow",
};

export const COLOR_LAB: ColorLabEntry[] = COLOR_CATALOG.map((c) => ({
  name: c.name,
  animated: c.isAnimated,
  group: c.isAnimated ? "moving" : "static",
  note: NOTES[c.name] ?? (c.isAnimated ? "Moving" : "Solid"),
  karmaNeeded: c.karmaNeeded,
  priceT: c.priceT,
  strength: c.strength,
}));

export function colorLevelSwatch(name: string | null | undefined): string {
  if (!name) return SWATCH.white;
  return SWATCH[name.trim().toLowerCase()] ?? SWATCH.white;
}

export function colorLevelSlug(name: string | null | undefined): string {
  return (name ?? "white").trim().toLowerCase().replace(/\s+/g, "-");
}

export function isAnimatedColor(name: string | null | undefined): boolean {
  return ANIMATED.has((name ?? "").trim().toLowerCase());
}

export function isTvStarColor(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "tv star";
}

export function colorLevelSwatchClass(name: string | null | undefined, animated?: boolean): string {
  const slug = colorLevelSlug(name);
  const move = animated ?? isAnimatedColor(name);
  return `lvl-${slug}${move ? " animated" : " static"}`;
}
