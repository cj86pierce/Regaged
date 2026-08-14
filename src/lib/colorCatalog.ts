export type ColorDef = {
  id: number;
  name: string;
  karmaNeeded: number;
  priceT: number;
  strength: number;
  isAnimated: boolean;
};

/** 20-color buy ladder. TV Star is last, most expensive, and highest power. */
export const TV_STAR_ID = 19;

export const COLOR_CATALOG: ColorDef[] = [
  { id: 0, name: "White", karmaNeeded: 0, priceT: 0, strength: 1, isAnimated: false },
  { id: 1, name: "Yellow", karmaNeeded: 15, priceT: 30, strength: 2, isAnimated: false },
  { id: 2, name: "Orange", karmaNeeded: 30, priceT: 40, strength: 3, isAnimated: false },
  { id: 3, name: "Light Green", karmaNeeded: 60, priceT: 50, strength: 4, isAnimated: false },
  { id: 4, name: "Green", karmaNeeded: 90, priceT: 80, strength: 5, isAnimated: false },
  { id: 5, name: "Blue", karmaNeeded: 120, priceT: 90, strength: 6, isAnimated: false },
  { id: 6, name: "Purple", karmaNeeded: 180, priceT: 100, strength: 7, isAnimated: false },
  { id: 7, name: "Red", karmaNeeded: 200, priceT: 120, strength: 8, isAnimated: false },
  { id: 8, name: "Brown", karmaNeeded: 240, priceT: 140, strength: 9, isAnimated: false },
  { id: 9, name: "Black", karmaNeeded: 350, priceT: 200, strength: 10, isAnimated: false },
  { id: 10, name: "Silver", karmaNeeded: 600, priceT: 300, strength: 11, isAnimated: true },
  { id: 11, name: "Gold", karmaNeeded: 1000, priceT: 400, strength: 12, isAnimated: true },
  { id: 12, name: "Sky", karmaNeeded: 1300, priceT: 500, strength: 15, isAnimated: true },
  { id: 13, name: "Blood", karmaNeeded: 1500, priceT: 600, strength: 20, isAnimated: true },
  { id: 14, name: "Ultra Gold", karmaNeeded: 3000, priceT: 1500, strength: 30, isAnimated: true },
  { id: 15, name: "Titanium", karmaNeeded: 5000, priceT: 2000, strength: 32, isAnimated: true },
  { id: 16, name: "Chroma", karmaNeeded: 10000, priceT: 2500, strength: 34, isAnimated: true },
  { id: 17, name: "Holofoil", karmaNeeded: 15000, priceT: 3000, strength: 36, isAnimated: true },
  { id: 18, name: "Crystal", karmaNeeded: 20000, priceT: 3500, strength: 38, isAnimated: true },
  { id: 19, name: "TV Star", karmaNeeded: 25000, priceT: 4000, strength: 40, isAnimated: true },
];

/** Tengaged: max Rookies bet is double color strength (Yellow 2x → 4 T$, TV Star 40x → 80 T$). */
export function maxBetTFromStrength(strength: number): number {
  return Math.max(2, strength * 2);
}
