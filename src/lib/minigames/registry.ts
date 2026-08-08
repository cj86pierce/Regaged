/**
 * Shared minigame registry + uncapped Challenge Score converters.
 * Scores are relative across games (similar average ballpark) but have no hard cap.
 * Kept within JS/Prisma Int32 (~2.1e9) via formula design, not gameplay ceilings.
 */

export const MINIGAME_IDS = [
  "matching",
  "match3",
  "rhythm",
  "deal",
  "simon",
  "reaction",
  "mathrush",
  "dodge",
] as const;

export type MinigameId = (typeof MINIGAME_IDS)[number];

export type MinigameRaw = Record<string, number>;

export type MinigameDef = {
  id: MinigameId;
  name: string;
  blurb: string;
  /** Typical average Challenge Score (for bot sampling). */
  averageScore: number;
  sanitizeRaw: (raw: unknown) => MinigameRaw | null;
  toChallengeScore: (raw: MinigameRaw) => number;
};

const INT_MAX = 2_147_483_647;

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(INT_MAX, Math.floor(n)));
}

function num(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const MINIGAME_DEFS: Record<MinigameId, MinigameDef> = {
  matching: {
    id: "matching",
    name: "Fruit Match",
    blurb: "Flip cards to find matching pairs. Faster = better.",
    averageScore: 250_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const timeMs = Math.round(num(r.timeMs));
      const moves = Math.round(num(r.moves));
      if (timeMs < 200 || timeMs > 600_000) return null;
      if (moves < 6 || moves > 500) return null;
      return { timeMs, moves };
    },
    toChallengeScore: (raw) => {
      // ~4s → 250k; every ms changes score; fewer moves adds a tiny residual
      const speed = Math.floor(1_000_000_000 / Math.max(raw.timeMs, 1));
      const moveBonus = Math.max(0, 200 - raw.moves);
      return clampInt(speed + moveBonus);
    },
  },

  match3: {
    id: "match3",
    name: "Candy Match",
    blurb: "90s timed Match-3. Board reshuffles if no moves left.",
    averageScore: 40_000_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const cleared = Math.round(num(r.cleared));
      const cascades = Math.round(num(r.cascades));
      // leftoverMs preferred; accept leftoverMoves for any in-flight clients
      const leftoverMs = Math.round(num(r.leftoverMs, num(r.leftoverMoves)));
      if (cleared < 0 || cleared > 20_000) return null;
      if (cascades < 0 || cascades > 10_000) return null;
      if (leftoverMs < 0 || leftoverMs > 180_000) return null;
      return { cleared, cascades, leftoverMs };
    },
    toChallengeScore: (raw) =>
      clampInt(raw.cleared * 1_000_000 + raw.cascades * 1_000 + raw.leftoverMs),
  },

  rhythm: {
    id: "rhythm",
    name: "Beat Tap",
    blurb: "Hit falling notes in time. Accuracy and combos pay off.",
    averageScore: 800_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const points = Math.round(num(r.points));
      const maxCombo = Math.round(num(r.maxCombo));
      const residualMs = Math.round(num(r.residualMs));
      if (points < 0 || points > 5_000_000) return null;
      if (maxCombo < 0 || maxCombo > 500) return null;
      if (residualMs < 0 || residualMs > 60_000) return null;
      return { points, maxCombo, residualMs };
    },
    toChallengeScore: (raw) =>
      clampInt(raw.points * 100 + raw.maxCombo * 1_000 + raw.residualMs),
  },

  deal: {
    id: "deal",
    name: "Deal or No Deal",
    blurb: "Open cases, face the banker, decide: Deal or No Deal?",
    averageScore: 250_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const finalCash = Math.round(num(r.finalCash));
      const roundsPlayed = Math.round(num(r.roundsPlayed));
      const beatBanker = Math.round(num(r.beatBanker)); // 0 or 1
      if (finalCash < 0 || finalCash > 1_000_000) return null;
      if (roundsPlayed < 0 || roundsPlayed > 30) return null;
      if (beatBanker !== 0 && beatBanker !== 1) return null;
      return { finalCash, roundsPlayed, beatBanker };
    },
    toChallengeScore: (raw) =>
      clampInt(raw.finalCash * 10 + raw.roundsPlayed * 97 + raw.beatBanker * 50_000),
  },

  simon: {
    id: "simon",
    name: "Echo",
    blurb: "Watch the sequence, then repeat it. How long can you go?",
    averageScore: 120_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const level = Math.round(num(r.level));
      const residualMs = Math.round(num(r.residualMs));
      if (level < 0 || level > 100) return null;
      if (residualMs < 0 || residualMs > 120_000) return null;
      return { level, residualMs };
    },
    toChallengeScore: (raw) => clampInt(raw.level * 50_000 + raw.residualMs),
  },

  reaction: {
    id: "reaction",
    name: "Quick Shot",
    blurb: "Click targets as they appear. Hits and speed win.",
    averageScore: 350_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const hits = Math.round(num(r.hits));
      const misses = Math.round(num(r.misses));
      const residualMs = Math.round(num(r.residualMs));
      if (hits < 0 || hits > 500) return null;
      if (misses < 0 || misses > 500) return null;
      if (residualMs < 0 || residualMs > 60_000) return null;
      return { hits, misses, residualMs };
    },
    toChallengeScore: (raw) =>
      clampInt(raw.hits * 25_000 - raw.misses * 8_000 + raw.residualMs),
  },

  mathrush: {
    id: "mathrush",
    name: "Brain Blitz",
    blurb: "Solve as many quick math problems as you can.",
    averageScore: 400_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const correct = Math.round(num(r.correct));
      const wrong = Math.round(num(r.wrong));
      const maxStreak = Math.round(num(r.maxStreak));
      const residualMs = Math.round(num(r.residualMs));
      if (correct < 0 || correct > 500) return null;
      if (wrong < 0 || wrong > 500) return null;
      if (maxStreak < 0 || maxStreak > 500) return null;
      if (residualMs < 0 || residualMs > 60_000) return null;
      return { correct, wrong, maxStreak, residualMs };
    },
    toChallengeScore: (raw) =>
      clampInt(raw.correct * 40_000 + raw.maxStreak * 5_000 - raw.wrong * 10_000 + raw.residualMs),
  },

  dodge: {
    id: "dodge",
    name: "Lane Dash",
    blurb: "Stay alive — dodge obstacles as long as you can.",
    averageScore: 300_000,
    sanitizeRaw: (raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const survivedMs = Math.round(num(r.survivedMs));
      const nearMisses = Math.round(num(r.nearMisses));
      if (survivedMs < 0 || survivedMs > 180_000) return null;
      if (nearMisses < 0 || nearMisses > 500) return null;
      return { survivedMs, nearMisses };
    },
    toChallengeScore: (raw) => clampInt(raw.survivedMs * 100 + raw.nearMisses * 1_337),
  },
};

export function isMinigameId(v: unknown): v is MinigameId {
  return typeof v === "string" && (MINIGAME_IDS as readonly string[]).includes(v);
}

export function getMinigameDef(id: MinigameId): MinigameDef {
  return MINIGAME_DEFS[id];
}

export function toChallengeScore(id: MinigameId, raw: unknown): number | null {
  const def = MINIGAME_DEFS[id];
  const sanitized = def.sanitizeRaw(raw);
  if (!sanitized) return null;
  return def.toChallengeScore(sanitized);
}

/**
 * Sample a competitive bot score: clustered near a strong human average,
 * with occasional standouts and a few weak runs so results feel real.
 */
export function sampleBotChallengeScore(id: MinigameId, rng = Math.random): number {
  const avg = MINIGAME_DEFS[id].averageScore;
  const roll = rng();
  // ~12% weak, ~63% solid mid/high, ~25% standout
  let band: number;
  if (roll < 0.12) band = 0.45 + rng() * 0.35;
  else if (roll < 0.75) band = 0.85 + rng() * 0.45;
  else band = 1.2 + rng() * 0.85;

  const u1 = Math.max(1e-9, rng());
  const u2 = Math.max(1e-9, rng());
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const jitter = Math.exp(z * 0.22);
  return clampInt(avg * band * jitter);
}
