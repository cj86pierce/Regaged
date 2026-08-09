export type EnrollGameType =
  | "FASTING"
  | "CASTING"
  | "FASTING_BOT"
  | "CASTING_BOT"
  | "FROOKIES"
  | "ROOKIES"
  | "FROOKIES_BOT"
  | "ROOKIES_BOT"
  | "SURVIVOR"
  | "SURVIVOR_BOT";

export type EnrollRequirements = {
  /** Null = any / free (White). */
  colorName: string | null;
  feeT: number;
  practice: boolean;
};

export function getEnrollRequirements(gameType: EnrollGameType): EnrollRequirements {
  switch (gameType) {
    case "FROOKIES":
    case "SURVIVOR":
      return { colorName: "Yellow", feeT: 10, practice: false };
    case "ROOKIES":
      return { colorName: "Yellow", feeT: 15, practice: false };
    case "FASTING_BOT":
    case "CASTING_BOT":
    case "FROOKIES_BOT":
    case "ROOKIES_BOT":
    case "SURVIVOR_BOT":
      return { colorName: null, feeT: 0, practice: true };
    default:
      return { colorName: null, feeT: 0, practice: false };
  }
}
