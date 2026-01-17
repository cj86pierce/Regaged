import {
  SLURS,
  SEXUAL_GRAPHIC,
  SEXUAL_EXPLOITATION,
} from "./index";

const BLOCKED = [
  ...SLURS,
  ...SEXUAL_GRAPHIC,
  ...SEXUAL_EXPLOITATION,
];

const wordRegex = new RegExp(
  `\\b(${BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

export function sanitizeContent(text: string) {
  if (!text) return { ok: true, text };

  const hit = text.match(wordRegex);
  if (hit) {
    return {
      ok: false,
      reason: "CONTENT_BLOCKED",
      word: hit[0],
    };
  }

  return { ok: true, text };
}
