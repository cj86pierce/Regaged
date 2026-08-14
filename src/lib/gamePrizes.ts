/**
 * Placement prizes for engaged games (karma K + T$).
 * Karma is stored in K units (12 = 12K). T$ is tMoney / R$.
 *
 * Source: Tengaged “Table 2. Prizes for engaged games.”
 *   CASTING FAST  = Fastings
 *   CASTING SLOW  = Castings
 *   ROOKIES FAST  = Frookies
 *   ROOKIES SLOW  = Rookies
 */

export type Prize = { karma: number; tMoney: number };

function k(karma: number, tMoney: number): Prize {
  return { karma, tMoney };
}

/** Fastings (CASTING FAST): 1st–3rd. */
export const CASTING_FAST_PRIZES: Record<number, Prize> = {
  1: k(12, 8),
  2: k(2, 6),
  3: k(1, 4),
};

/** Castings (CASTING SLOW): 1st–13th (14–20 are 0/0). */
export const CASTING_SLOW_PRIZES: Record<number, Prize> = {
  1: k(40, 20),
  2: k(10, 16),
  3: k(9, 14),
  4: k(8, 10),
  5: k(7, 9),
  6: k(6, 8),
  7: k(5, 7),
  8: k(4, 6),
  9: k(3, 5),
  10: k(2, 4),
  11: k(1, 3),
  12: k(0, 2),
  13: k(0, 2),
};

/** Frookies (ROOKIES FAST): 1st–5th (6th is 0/0). */
export const ROOKIES_FAST_PRIZES: Record<number, Prize> = {
  1: k(25, 60),
  2: k(3, 20),
  3: k(0, 10),
  4: k(0, 10),
  5: k(0, 10),
};

/** Rookies (ROOKIES SLOW): 1st–10th (11–13 are 0/0). */
export const ROOKIES_SLOW_PRIZES: Record<number, Prize> = {
  1: k(80, 50),
  2: k(20, 30),
  3: k(15, 20),
  4: k(10, 10),
  5: k(8, 5),
  6: k(6, 0),
  7: k(5, 0),
  8: k(4, 0),
  9: k(2, 0),
  10: k(1, 0),
};

/** Survivor 1st = make merge (and merge-season finish). */
export const SURVIVOR_MERGE_PRIZE: Prize = k(40, 10);

/** Hunger Games — not live yet; amounts locked to the table. */
export const HUNGER_PRIZES: Record<number, Prize> = {
  1: k(140, 300),
  2: k(60, 100),
  3: k(20, 60),
  4: k(10, 40),
};

/** Stars — not live yet; amounts locked to the table. */
export const STARS_PRIZES: Record<number, Prize> = {
  1: k(300, 1000),
  2: k(90, 120),
  3: k(50, 80),
  4: k(0, 60),
  5: k(0, 45),
};

export function prizeForPlace(table: Record<number, Prize>, place: number): Prize | null {
  const p = table[place];
  if (!p) return null;
  if (p.karma <= 0 && p.tMoney <= 0) return null;
  return p;
}

/** Non-zero placements as { place, karma, t } for finish-game loops. */
export function placementPayoutList(table: Record<number, Prize>): { place: number; karma: number; t: number }[] {
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
    .map((place) => ({ place, karma: table[place]!.karma, t: table[place]!.tMoney }))
    .filter((p) => p.karma > 0 || p.t > 0);
}
