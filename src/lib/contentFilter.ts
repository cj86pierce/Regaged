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
 * Put your real lists in env vars:
 * SLUR_BLOCKLIST="word1,word2"
 * GRAPHIC_BLOCKLIST="phrase1,phrase2"
 */
export function checkBlockedContent(input: string): null | { reason: "slur" | "graphic"; match: string } {
  const norm = normalize(input);

  const slurs = parseCsvEnv("SLUR_BLOCKLIST");
  for (const w of slurs) {
    const re = new RegExp(`(^|\\s)${escapeRegExp(w)}(\\s|$)`, "i");
    if (re.test(norm)) return { reason: "slur", match: w };
  }

  const graphic = parseCsvEnv("GRAPHIC_BLOCKLIST");
  for (const w of graphic) {
    const ww = normalize(w);
    const re = new RegExp(`(^|\\s)${escapeRegExp(ww)}(\\s|$)`, "i");
    if (re.test(norm)) return { reason: "graphic", match: w };
  }

  return null;
}
