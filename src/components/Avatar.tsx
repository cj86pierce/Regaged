"use client";

import { useEffect, useMemo, useState } from "react";

export type AvatarConfig = {
  bodyStyle: "body_m" | "body_f";
  shirtStyle: string; // shirt_01..shirt_06
  eyesStyle: string;  // eyes_01..eyes_06
  mouthStyle: string; // mouth_01..mouth_06
  hairStyle: string;  // hair_m_01.. hair_f_03..
  accessoryStyle: string; // none | accessory_01

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
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

// Cache tinted outputs so we don’t re-render constantly
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

// Tint grayscale png -> colored png while preserving shading
async function tintPng(src: string, colorHex: string): Promise<string> {
  const key = `${src}@@${colorHex}`;
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

  // For each pixel:
  // intensity = grayscale value (0..1) from the pixel luminance
  // output = chosenColor * intensity, alpha unchanged
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Luma (works even if “mostly grayscale”)
    const intensity = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    data[i]     = Math.round(cr * intensity);
    data[i + 1] = Math.round(cg * intensity);
    data[i + 2] = Math.round(cb * intensity);
    // alpha unchanged
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

    tintPng(src, color)
      .then((url) => {
        if (alive) setOut(url);
      })
      .catch(() => {
        if (alive) setOut(null);
      });

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

  // Eyes: per-style whites + per-style iris
  const eyesWhiteSrc = `/avatars/eyes/${safe.eyesStyle}_white.png`;
  const eyesIrisSrc = `/avatars/eyes/${safe.eyesStyle}.png`;

  const accessorySrc =
    safe.accessoryStyle !== "none" ? `/avatars/accessories/${safe.accessoryStyle}.png` : null;

  // Canvas-tinted urls
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

      {/* Eyes: whites plain + iris tinted */}
      <img src={eyesWhiteSrc} alt="" style={{ ...layer, zIndex: 5 }} />
      <img src={eyesIrisTinted ?? eyesIrisSrc} alt="" style={{ ...layer, zIndex: 6 }} />

      <img src={hairTinted ?? hairSrc} alt="" style={{ ...layer, zIndex: 7 }} />
      {accessorySrc && <img src={accessoryTinted ?? accessorySrc} alt="" style={{ ...layer, zIndex: 8 }} />}
    </div>
  );
}
