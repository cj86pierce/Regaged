export const SURVIVOR_MAX = 20;
export const SURVIVOR_DAY_MS = 24 * 60 * 60 * 1000;
export const SURVIVOR_BOT_PHASE_MS = 2 * 60 * 1000;

export function survivorPhaseMs(isBot: boolean): number {
  return isBot ? SURVIVOR_BOT_PHASE_MS : SURVIVOR_DAY_MS;
}
