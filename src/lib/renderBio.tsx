import React from "react";

const IMG_URL_RE =
  /https?:\/\/[^\s<>"']+\.(?:gif|webp|png|jpe?g)(?:\?[^\s<>"']*)?/gi;
const GIPHY_TENOR_RE =
  /https?:\/\/(?:media\d*\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\/[^\s<>"']+/gi;

function isSafeHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Render bio text with safe image/GIF URLs as <img>. Escapes everything else as text. */
export function renderBioContent(bio: string): React.ReactNode {
  const text = (bio ?? "").trim();
  if (!text) return null;

  const matches: { start: number; end: number; url: string }[] = [];
  const addMatches = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const url = m[0].replace(/[),.;]+$/, "");
      if (!isSafeHttpsUrl(url)) continue;
      matches.push({ start: m.index, end: m.index + url.length, url });
    }
  };
  addMatches(IMG_URL_RE);
  addMatches(GIPHY_TENOR_RE);

  matches.sort((a, b) => a.start - b.start);
  const deduped: typeof matches = [];
  for (const m of matches) {
    const last = deduped[deduped.length - 1];
    if (last && m.start < last.end) continue;
    deduped.push(m);
  }

  if (deduped.length === 0) {
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  deduped.forEach((m, i) => {
    if (m.start > cursor) {
      nodes.push(
        <span key={`t-${i}`} style={{ whiteSpace: "pre-wrap" }}>
          {text.slice(cursor, m.start)}
        </span>
      );
    }
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`i-${i}`}
        src={m.url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: 220,
          margin: "8px 0",
          borderRadius: 4,
        }}
      />
    );
    cursor = m.end;
  });
  if (cursor < text.length) {
    nodes.push(
      <span key="t-end" style={{ whiteSpace: "pre-wrap" }}>
        {text.slice(cursor)}
      </span>
    );
  }
  return <>{nodes}</>;
}
