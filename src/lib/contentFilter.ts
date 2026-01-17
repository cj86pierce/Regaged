function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/[@$]/g, "a")
    .replace(/[!]/g, "i")
    .replace(/[1|]/g, "i")
    .replace(/3/g, "e")
    .replace(/0/g, "o")
    .replace(/7/g, "t")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCsvEnv(name: string) {
  const raw = process.env[name] ?? "";
  return raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * ✅ Built-in defaults for beta (works even if env vars are missing)
 * Keep this list small and focused: slurs + graphic content only.
 *
 * Later you can move this to env/DB if you want.
 */
const DEFAULT_SLURS = [
  "fag",
  "faggot",
  "nigger",
  "nigga",
  "chink",
  "kike",
  "spic",
  "wetback",
  "gook",
  "beaner",
  "jap",
  "coon",
  "dyke",
];

const DEFAULT_GRAPHIC = [
  "rape",
  "rapist",
  "pedophile",
  "pedophilia",
  "pedo",
  "bestiality",
  "bukkake",
  "cumshot",
  "cunnilingus",
  "fisting",
  "incest",
  "pornography",
  "porn",
  "xxx",
];

function buildWordRegex(words: string[]) {
  // word boundary match on normalized text
  const cleaned = words.map((w) => normalize(w)).filter(Boolean);
  if (cleaned.length === 0) return null;
  const pattern = cleaned.map(escapeRegExp).join("|");
  return new RegExp(`(^|\\s)(${pattern})(\\s|$)`, "i");
}

export function checkBlockedContent(input: string): null | { reason: "slur" | "graphic"; match: string } {
  const norm = normalize(input);

  // env vars can add more terms without redeploy
  const slurs = [...DEFAULT_SLURS, ...parseCsvEnv("SLUR_BLOCKLIST")];
  const graphic = [...DEFAULT_GRAPHIC, ...parseCsvEnv("GRAPHIC_BLOCKLIST")];

  const slurRe = buildWordRegex(slurs);
  if (slurRe) {
    const m = norm.match(slurRe);
    if (m) return { reason: "slur", match: m[2] };
  }

  const graphicRe = buildWordRegex(graphic);
  if (graphicRe) {
    const m = norm.match(graphicRe);
    if (m) return { reason: "graphic", match: m[2] };
  }

  return null;
}
