/** Display swatches for color levels (username belt, shop, etc.). */
const SWATCH: Record<string, string> = {
  white: "#ffffff",
  yellow: "#ffeb3b",
  orange: "#ff9800",
  "light green": "#8bc34a",
  green: "#2e7d32",
  blue: "#1e88e5",
  purple: "#8e24aa",
  red: "#e53935",
  brown: "#6d4c41",
  black: "#111111",
  silver: "#c0c0c0",
  gold: "#ffd700",
  sky: "#4fc3f7",
  blood: "#8b0000",
  "tv star": "#ff66cc",
  "ugly olive": "#556b2f",
};

export function colorLevelSwatch(name: string | null | undefined): string {
  if (!name) return SWATCH.white;
  return SWATCH[name.trim().toLowerCase()] ?? SWATCH.white;
}

export function isTvStarColor(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "tv star";
}
