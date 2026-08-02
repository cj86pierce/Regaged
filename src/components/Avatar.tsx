"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AVATAR_ASSET_VERSION } from "@/lib/avatarStyles";

function assetUrl(path: string | null): string | null {
  if (!path) return null;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}v=${AVATAR_ASSET_VERSION}`;
}

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

const ASPECT = 230 / 200;

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
const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return cached;

  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Tint grayscale PNG -> colored PNG preserving shading.
 * Upsamples 2x while tinting so later retina draws stay sharper.
 */
async function tintPngWithReferenceGray(src: string, colorHex: string): Promise<string> {
  const key = `${src}@@${colorHex}@@ref80@x2`;
  const cached = tintCache.get(key);
  if (cached) return cached;

  const img = await loadImage(src);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const { r: cr, g: cg, b: cb } = hexToRgb(colorHex);

  const refGray = 0.8;
  const minIntensity = 0.08;
  const maxIntensity = 1.15;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (l < 0.1) {
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
  slotDesigns?: Partial<Record<SlotDesignType, string>>;
}) {
  const w = width;
  const h = Math.round(width * ASPECT);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const safe = useMemo(
    () => ({
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
      hairOrnamentColor: normHex(
        config.hairOrnamentColor ?? DEFAULTS.hairOrnamentColor,
        DEFAULTS.hairOrnamentColor
      ),
      accessoryStyle: config.accessoryStyle ?? DEFAULTS.accessoryStyle,
      glassesStyle: config.glassesStyle ?? DEFAULTS.glassesStyle,
      scarStyle: config.scarStyle ?? DEFAULTS.scarStyle,
      hairOrnamentStyle: config.hairOrnamentStyle ?? DEFAULTS.hairOrnamentStyle,
    }),
    [config]
  );

  const bodySrc = assetUrl(`/avatars/body/${safe.bodyStyle}.png`)!;
  const shirtBaseSrc = assetUrl(`/avatars/shirts/${safe.shirtStyle}_base.png`)!;
  const shirtHighlightSrc = assetUrl(`/avatars/shirts/${safe.shirtStyle}_highlight.png`)!;
  const hasHighlight = safe.shirtStyle === "shirt_01";
  const mouthSrc = assetUrl(`/avatars/mouth/${safe.mouthStyle}.png`)!;
  const hairSrc = assetUrl(`/avatars/hair/${safe.hairStyle}.png`)!;
  const eyesWhiteSrc = assetUrl(`/avatars/eyes/${safe.eyesStyle}_white.png`)!;
  const eyesIrisSrc = assetUrl(`/avatars/eyes/${safe.eyesStyle}.png`)!;
  const accessorySrc = assetUrl(
    safe.accessoryStyle !== "none" ? `/avatars/accessories/${safe.accessoryStyle}.png` : null
  );
  const glassesSrc = assetUrl(
    safe.glassesStyle !== "none" ? `/avatars/glasses/${safe.glassesStyle}.png` : null
  );
  const scarSrc = assetUrl(safe.scarStyle !== "none" ? `/avatars/scars/${safe.scarStyle}.png` : null);
  const hairOrnamentSrc = assetUrl(
    safe.hairOrnamentStyle !== "none" ? `/avatars/hair-ornaments/${safe.hairOrnamentStyle}.png` : null
  );

  const bodyTinted = useTint(slotDesigns?.BODY ? null : bodySrc, safe.bodyColor);
  const shirtTinted = useTint(slotDesigns?.SHIRT ? null : shirtBaseSrc, safe.shirtColor);
  const mouthTinted = useTint(slotDesigns?.MOUTH ? null : mouthSrc, safe.mouthColor);
  const hairTinted = useTint(slotDesigns?.HAIR ? null : hairSrc, safe.hairColor);
  const eyesIrisTinted = useTint(slotDesigns?.EYES ? null : eyesIrisSrc, safe.eyeColor);
  const accessoryTinted = useTint(slotDesigns?.ACCESSORY ? null : accessorySrc, safe.accessoryColor);
  const glassesTinted = useTint(slotDesigns?.GLASSES ? null : glassesSrc, safe.glassesColor);
  const scarTinted = useTint(slotDesigns?.SCAR ? null : scarSrc, safe.scarColor);
  const hairOrnamentTinted = useTint(
    slotDesigns?.HAIR_ORNAMENT ? null : hairOrnamentSrc,
    safe.hairOrnamentColor
  );

  const layers = useMemo(() => {
    const list: (string | null)[] = [
      slotDesigns?.BACKGROUND ?? null,
      slotDesigns?.BODY ?? bodyTinted ?? bodySrc,
      slotDesigns?.SCAR ? slotDesigns.SCAR : scarSrc ? scarTinted ?? scarSrc : null,
      slotDesigns?.SHIRT ?? shirtTinted ?? shirtBaseSrc,
      hasHighlight && !slotDesigns?.SHIRT ? shirtHighlightSrc : null,
      slotDesigns?.MOUTH ?? mouthTinted ?? mouthSrc,
      slotDesigns?.EYES ? null : eyesWhiteSrc,
      slotDesigns?.EYES ?? eyesIrisTinted ?? eyesIrisSrc,
      slotDesigns?.GLASSES ? slotDesigns.GLASSES : glassesSrc ? glassesTinted ?? glassesSrc : null,
      slotDesigns?.HAIR ?? hairTinted ?? hairSrc,
      slotDesigns?.HAIR_ORNAMENT
        ? slotDesigns.HAIR_ORNAMENT
        : hairOrnamentSrc
          ? hairOrnamentTinted ?? hairOrnamentSrc
          : null,
      slotDesigns?.ACCESSORY ? slotDesigns.ACCESSORY : accessorySrc ? accessoryTinted ?? accessorySrc : null,
    ];
    return list.filter(Boolean) as string[];
  }, [
    slotDesigns,
    bodyTinted,
    bodySrc,
    scarTinted,
    scarSrc,
    shirtTinted,
    shirtBaseSrc,
    hasHighlight,
    shirtHighlightSrc,
    mouthTinted,
    mouthSrc,
    eyesWhiteSrc,
    eyesIrisTinted,
    eyesIrisSrc,
    glassesTinted,
    glassesSrc,
    hairTinted,
    hairSrc,
    hairOrnamentTinted,
    hairOrnamentSrc,
    accessoryTinted,
    accessorySrc,
  ]);

  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2.5);
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, pw, ph);

    if (!slotDesigns?.BACKGROUND) {
      ctx.fillStyle = safe.backgroundColor;
      ctx.fillRect(0, 0, pw, ph);
    }

    (async () => {
      try {
        const images = await Promise.all(layers.map((src) => loadImage(src)));
        if (!alive) return;
        ctx.save();
        if (grayscale) ctx.filter = "grayscale(1)";
        for (const img of images) {
          ctx.drawImage(img, 0, 0, pw, ph);
        }
        ctx.restore();
        setReady(true);
      } catch {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [layers, w, h, grayscale, safe.backgroundColor, slotDesigns?.BACKGROUND]);

  return (
    <div
      className="avatarFrame"
      style={{
        width: w,
        height: h,
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.12)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        background: safe.backgroundColor,
        flexShrink: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="avatar"
        style={{
          display: "block",
          width: w,
          height: h,
          opacity: ready ? 1 : 0.35,
          transition: "opacity 0.15s ease",
        }}
      />
    </div>
  );
}
