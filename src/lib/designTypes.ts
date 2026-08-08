import type { DesignType } from "@prisma/client";

export const DESIGN_TYPES = [
  "BODY",
  "HAIR",
  "EYES",
  "MOUTH",
  "SHIRT",
  "ACCESSORY",
  "BACKGROUND",
  "SCAR",
  "HAIR_ORNAMENT",
  "GLASSES",
] as const satisfies readonly DesignType[];

export function parseDesignType(raw: unknown): DesignType | null {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if ((DESIGN_TYPES as readonly string[]).includes(s)) return s as DesignType;
  return null;
}

export function designTypeLabel(t: DesignType): string {
  switch (t) {
    case "HAIR_ORNAMENT":
      return "Hair ornament";
    default:
      return t.charAt(0) + t.slice(1).toLowerCase();
  }
}
