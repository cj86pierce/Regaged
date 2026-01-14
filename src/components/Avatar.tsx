"use client";

import { useEffect, useState } from "react";

export type AvatarConfig = {
  bodyStyle: "body_m" | "body_f";
  shirtStyle: string;
  eyesStyle: string;
  mouthStyle: string;
  hairStyle: string;
  accessoryStyle: string;

  bodyColor: string;
  shirtColor: string;
  eyeColor: string;
  mouthColor: string;
  hairColor: string;
  accessoryColor: string;
};

const DEFAULTS = {
  mouthColor: "#E0AC69",
  accessoryStyle: "none",
  accessoryColor: "#111111",
} as const;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
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

// Normalize luminance so “main gray” becomes full color.
// This fixes the “everything is dark” problem when your base PNGs are mid-gray.
async function tintPngNormalized(src: string, colorHex: string): Promise<string> {
  const key = `${src}@@${colorHex}@@norm1`;
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

  // 1) find min/max luminance for non-transparent pixels
  let minL = 1;
  let maxL = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..1
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }

  // Prevent divide by zero (flat image)
  const range = Math.max(0.0001, maxL - minL);

  const { r: cr, g: cg, b: cb } = hexToRgb(colorHex);

  // 2) apply normalized tint
  // lNorm = (l - minL) / range  -> 0..1
  // Add slight gamma to keep highlights nicer
  const gamma = 0.85;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let lNorm = (l - minL) / range;
    if (lNorm < 0) lNorm = 0;
    if (lNorm > 1) lNorm = 1;

    // gamma curve to avoid “muddy” look
    const intensity = Math.pow(lNorm, gamma);

    data[i]     = Math.round(cr * intensity);
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

    tintPngNormalized(src, color)
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
}: {
  config: AvatarConfig;
  width?: number;
  grayscale?: boolean;
}) {
  const w = width;
  const h = Math.round(width * (230 / 200));

  const safe = {
    ...config,
    mouthColor: config.mouthColor || DEFAULTS.mouthColor,
    accessoryStyle: config.accessoryStyle ?? DEFAULTS.accessoryStyle,
    accessoryColor: config.accessoryColor || DEFAULTS.accessoryColor,
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

  const bodyTinted = useTint(bodySrc, safe.bodyColor);
  const shirtTinted = useTint(shirtBaseSrc, safe.shirtColor);
  const mouthTinted = useTint(mouthSrc, safe.mouthColor);
  const hairTinted = useTint(hairSrc, safe.hairColor);
  const eyesIrisTinted = useTint(eyesIrisSrc, safe.eyeColor);
  const accessoryTinted = useTint(accessorySrc, safe.accessoryColor);

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
  };

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.15)",
        background: "#fff",
        filter: grayscale ? "grayscale(1)" : "none",
      }}
    >
      {/* Bottom → Top */}
      <img src={bodyTinted ?? bodySrc} alt="" style={{ ...layer, zIndex: 1 }} />
      <img src={shirtTinted ?? shirtBaseSrc} alt="" style={{ ...layer, zIndex: 2 }} />
      {hasHighlight && <img src={shirtHighlightSrc} alt="" style={{ ...layer, zIndex: 3 }} />}
      <img src={mouthTinted ?? mouthSrc} alt="" style={{ ...layer, zIndex: 4 }} />

      <img src={eyesWhiteSrc} alt="" style={{ ...layer, zIndex: 5 }} />
      <img src={eyesIrisTinted ?? eyesIrisSrc} alt="" style={{ ...layer, zIndex: 6 }} />

      <img src={hairTinted ?? hairSrc} alt="" style={{ ...layer, zIndex: 7 }} />
      {accessorySrc && <img src={accessoryTinted ?? accessorySrc} alt="" style={{ ...layer, zIndex: 8 }} />}
    </div>
  );
}
