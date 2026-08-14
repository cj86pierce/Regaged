/** Practice *_BOT rooms (instant fill, short phases). Live 15-min auto-fill is separate. */
export const PRACTICE_BOT_ENABLED = false;

export const PRACTICE_BOT_TYPES = [
  "FASTING_BOT",
  "CASTING_BOT",
  "FROOKIES_BOT",
  "ROOKIES_BOT",
  "SURVIVOR_BOT",
] as const;

export type PracticeBotType = (typeof PRACTICE_BOT_TYPES)[number];

export function isPracticeBotType(gameType: string): boolean {
  return (PRACTICE_BOT_TYPES as readonly string[]).includes(gameType);
}

export const PRACTICE_BOT_DISABLED_MESSAGE =
  "Practice bot rooms are paused. Join a live lobby — empty seats still bot-fill after 15 minutes.";
