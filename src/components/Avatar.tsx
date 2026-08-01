"use client";

import { useEffect, useState } from "react";

export type AvatarConfig = {
  bodyStyle: "body_m" | "body_f";
  shirtStyle: string;
  eyesStyle: string;
  mouthStyle: string;
  hairStyle: string;
  accessoryStyle: string;
  glassesStyle: string;
  scarStyle: string;
  hairOrnamentStyle: string;

  bodyColor: string;
  shirtColor: string;
  eyeColor: string;
  mouthColor: string;
  hairColor: string;
  accessoryColor: string;
  backgroundColor: string;
  glassesColor: string;
  scarColor: string;
  hairOrnamentColor: string;
};

/** Design type slot overrides: URL for custom design image to replace that layer. */
export type SlotDesignType =
  | "BODY"
  | "HAIR"
  | "EYES"
  | "MOUTH"
  | "SHIRT"
  | "ACCESSORY"
  | "BACKGROUND"
  | "SCAR"
  | "HAIR_ORNAMENT"
  | "GLASSES";

const DEFAULTS = {
  bodyColor: "#F1C27D",
  hairColor: "#2B1B0E",
  eyeColor: "#2E7DFF",
  mouthColor: "#E0AC69",
  shirtColor: "#E53935",
  accessoryStyle: "none",
  accessoryColor: "#111111",
  backgroundColor: "#E8E8E8",
  glassesStyle: "none",
  glassesColor: "#111111",
  scarStyle: "none",
  scarColor: "#8B4513",
  hairOrnamentStyle: "none",
  hairOrnamentColor: "#C0C0C0",
} as const;

function isHex6(c: string) {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

function normHex(c: string, fallback: string) {
  if (!c) return fallback;
  const v = c.startsWith("#") ? c : `#${c}`;
  return isHex6(v) ? v : fallback;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const tintCache = new Map<string, string>();

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Tint grayscale PNG -> colored PNG preserving shading.
 *
 * Key trick:
 * - Assume your art "normal fill" is a light gray reference (like ~0.80).
 * - intensity = luminance / refGray
 *   so refGray becomes full color, darker becomes shadow, lighter becomes highlight.
 *
 * This avoids min/max normalization quirks and prevents everything going dark.
 */
async function tintPngWithReferenceGray(src: string, colorHex: string): Promise<string> {
  const key = `${src}@@${colorHex}@@ref80`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const img = await loadImage(src);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const { r: cr, g: cg, b: cb } = hexToRgb(colorHex);

  // Tune this if your “base gray” is different
  const refGray = 0.80; // 80% gray -> full color
  const minIntensity = 0.08; // never go fully black unless pixel is nearly black
  const maxIntensity = 1.15; // allow slight brightening

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // luminance 0..1
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // If the pixel is very dark (outline), keep it dark instead of tinting
    if (l < 0.10) {
      data[i] = 20;
      data[i + 1] = 20;
      data[i + 2] = 20;
      continue;
    }

    let intensity = l / refGray;
    if (intensity < minIntensity) intensity = minIntensity;
    if (intensity > maxIntensity) intensity = maxIntensity;

    data[i] = Math.round(cr * intensity);
    data[i + 1] = Math.round(cg * intensity);
    data[i + 2] = Math.round(cb * intensity);
  }

  ctx.putImageData(imageData, 0, 0);

  const out = canvas.toDataURL("image/png");
  tintCache.set(key, out);
  return out;
}

function useTint(src: string | null, color: string | null) {
  const [out, setOut] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!src || !color) {
      setOut(null);
      return;
    }

    tintPngWithReferenceGray(src, color)
      .then((url) => alive && setOut(url))
      .catch(() => alive && setOut(null));

    return () => {
      alive = false;
    };
  }, [src, color]);

  return out;
}

export default function Avatar({
  config,
  width = 200,
  grayscale = false,
  slotDesigns,
}: {
  config: AvatarConfig;
  width?: number;
  grayscale?: boolean;
  /** Custom design image URLs per slot; when set, replaces the default layer for that slot. */
  slotDesigns?: Partial<Record<SlotDesignType, string>>;
}) {
  const w = width;
  const h = Math.round(width * (230 / 200));

  // ✅ enforce valid colors so we never tint to black accidentally
  const safe = {
    ...config,
    bodyColor: normHex(config.bodyColor, DEFAULTS.bodyColor),
    hairColor: normHex(config.hairColor, DEFAULTS.hairColor),
    eyeColor: normHex(config.eyeColor, DEFAULTS.eyeColor),
    mouthColor: normHex(config.mouthColor, DEFAULTS.mouthColor),
    shirtColor: normHex(config.shirtColor, DEFAULTS.shirtColor),
    accessoryColor: normHex(config.accessoryColor, DEFAULTS.accessoryColor),
    backgroundColor: normHex(config.backgroundColor ?? DEFAULTS.backgroundColor, DEFAULTS.backgroundColor),
    glassesColor: normHex(config.glassesColor ?? DEFAULTS.glassesColor, DEFAULTS.glassesColor),
    scarColor: normHex(config.scarColor ?? DEFAULTS.scarColor, DEFAULTS.scarColor),
    hairOrnamentColor: normHex(config.hairOrnamentColor ?? DEFAULTS.hairOrnamentColor, DEFAULTS.hairOrnamentColor),
    accessoryStyle: config.accessoryStyle ?? DEFAULTS.accessoryStyle,
    glassesStyle: config.glassesStyle ?? DEFAULTS.glassesStyle,
    scarStyle: config.scarStyle ?? DEFAULTS.scarStyle,
    hairOrnamentStyle: config.hairOrnamentStyle ?? DEFAULTS.hairOrnamentStyle,
  };

  const bodySrc = `/avatars/body/${safe.bodyStyle}.png`;
  const shirtBaseSrc = `/avatars/shirts/${safe.shirtStyle}_base.png`;
  const shirtHighlightSrc = `/avatars/shirts/${safe.shirtStyle}_highlight.png`;
  const hasHighlight = safe.shirtStyle === "shirt_01";

  const mouthSrc = `/avatars/mouth/${safe.mouthStyle}.png`;
  const hairSrc = `/avatars/hair/${safe.hairStyle}.png`;

  const eyesWhiteSrc = `/avatars/eyes/${safe.eyesStyle}_white.png`;
  const eyesIrisSrc = `/avatars/eyes/${safe.eyesStyle}.png`;

  const accessorySrc =
    safe.accessoryStyle !== "none" ? `/avatars/accessories/${safe.accessoryStyle}.png` : null;
  const glassesSrc = safe.glassesStyle !== "none" ? `/avatars/glasses/${safe.glassesStyle}.png` : null;
  const scarSrc = safe.scarStyle !== "none" ? `/avatars/scars/${safe.scarStyle}.png` : null;
  const hairOrnamentSrc = safe.hairOrnamentStyle !== "none" ? `/avatars/hair-ornaments/${safe.hairOrnamentStyle}.png` : null;

  const bodyTinted = useTint(bodySrc, safe.bodyColor);
  const shirtTinted = useTint(shirtBaseSrc, safe.shirtColor);
  const mouthTinted = useTint(mouthSrc, safe.mouthColor);
  const hairTinted = useTint(hairSrc, safe.hairColor);
  const eyesIrisTinted = useTint(eyesIrisSrc, safe.eyeColor);
  const accessoryTinted = useTint(accessorySrc, safe.accessoryColor);
  const glassesTinted = useTint(glassesSrc, safe.glassesColor);
  const scarTinted = useTint(scarSrc, safe.scarColor);
  const hairOrnamentTinted = useTint(hairOrnamentSrc, safe.hairOrnamentColor);

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
  };

  const bodyImg = slotDesigns?.BODY ?? (bodyTinted ?? bodySrc);
  const shirtImg = slotDesigns?.SHIRT ?? (shirtTinted ?? shirtBaseSrc);
  const mouthImg = slotDesigns?.MOUTH ?? (mouthTinted ?? mouthSrc);
  const eyesWhite = slotDesigns?.EYES ? null : eyesWhiteSrc;
  const eyesIrisImg = slotDesigns?.EYES ?? (eyesIrisTinted ?? eyesIrisSrc);
  const hairImg = slotDesigns?.HAIR ?? (hairTinted ?? hairSrc);
  const accessoryImg = slotDesigns?.ACCESSORY ?? (accessorySrc ? (accessoryTinted ?? accessorySrc) : null);
  const scarImg = slotDesigns?.SCAR ?? (scarSrc ? (scarTinted ?? scarSrc) : null);
  const glassesImg = slotDesigns?.GLASSES ?? (glassesSrc ? (glassesTinted ?? glassesSrc) : null);
  const hairOrnamentImg = slotDesigns?.HAIR_ORNAMENT ?? (hairOrnamentSrc ? (hairOrnamentTinted ?? hairOrnamentSrc) : null);
  const backgroundImg = slotDesigns?.BACKGROUND ?? null;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.15)",
        background: backgroundImg ? undefined : (safe.backgroundColor ?? DEFAULTS.backgroundColor),
        filter: grayscale ? "grayscale(1)" : "none",
      }}
    >
      {backgroundImg && <img src={backgroundImg} alt="" style={{ ...layer, zIndex: 0 }} />}
      <img src={bodyImg} alt="" style={{ ...layer, zIndex: 1 }} />
      {scarImg && <img src={scarImg} alt="" style={{ ...layer, zIndex: 2 }} />}
      <img src={shirtImg} alt="" style={{ ...layer, zIndex: 3 }} />
      {hasHighlight && !slotDesigns?.SHIRT && <img src={shirtHighlightSrc} alt="" style={{ ...layer, zIndex: 4 }} />}
      <img src={mouthImg} alt="" style={{ ...layer, zIndex: 5 }} />
      {eyesWhite && <img src={eyesWhiteSrc} alt="" style={{ ...layer, zIndex: 6 }} />}
      <img src={eyesIrisImg} alt="" style={{ ...layer, zIndex: 7 }} />
      {glassesImg && <img src={glassesImg} alt="" style={{ ...layer, zIndex: 8 }} />}
      <img src={hairImg} alt="" style={{ ...layer, zIndex: 9 }} />
      {hairOrnamentImg && <img src={hairOrnamentImg} alt="" style={{ ...layer, zIndex: 10 }} />}
      {accessoryImg && <img src={accessoryImg} alt="" style={{ ...layer, zIndex: 11 }} />}
    </div>
  );
}
