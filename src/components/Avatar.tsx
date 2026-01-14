"use client";

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

function MaskFill({ maskSrc, color, zIndex }: { maskSrc: string; color: string; zIndex: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        backgroundColor: color,
        pointerEvents: "none",
        WebkitMaskImage: `url(${maskSrc})`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
        maskImage: `url(${maskSrc})`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
      }}
    />
  );
}

// ✅ Preserves shading: tint fill + multiply grayscale overlay
function TintedWithShading({ src, tint, zIndex }: { src: string; tint: string; zIndex: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        isolation: "isolate",
      }}
    >
      <MaskFill maskSrc={src} color={tint} zIndex={1} />
      <img
        src={src}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function LayerPlain({ src, zIndex }: { src: string; zIndex: number }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        zIndex,
        pointerEvents: "none",
      }}
    />
  );
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

  // safe defaults so missing values never render grey/blank
  const safe = {
    ...config,
    accessoryStyle: config.accessoryStyle ?? "none",
    mouthColor: config.mouthColor || "#E0AC69",
    accessoryColor: config.accessoryColor || "#111111",
  };

  const bodySrc = `/avatars/body/${safe.bodyStyle}.png`;
  const shirtBase = `/avatars/shirts/${safe.shirtStyle}_base.png`;

  const hasHighlight = safe.shirtStyle === "shirt_01";
  const shirtHighlight = `/avatars/shirts/${safe.shirtStyle}_highlight.png`;

  // ✅ per-style whites for eyes
  const eyesWhite = `/avatars/eyes/${safe.eyesStyle}_white.png`;
  const eyesIris = `/avatars/eyes/${safe.eyesStyle}.png`; // should be iris/outline only (transparent elsewhere)

  const mouthSrc = `/avatars/mouth/${safe.mouthStyle}.png`;
  const hairSrc = `/avatars/hair/${safe.hairStyle}.png`;

  const accessorySrc =
    safe.accessoryStyle !== "none" ? `/avatars/accessories/${safe.accessoryStyle}.png` : null;

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

      {/* BODY: flat tint (best-looking skin) */}
      <MaskFill maskSrc={bodySrc} color={safe.bodyColor} zIndex={1} />

      {/* SHIRT: preserve shading */}
      <TintedWithShading src={shirtBase} tint={safe.shirtColor} zIndex={2} />
      {hasHighlight && <LayerPlain src={shirtHighlight} zIndex={3} />}

      {/* MOUTH: preserve shading */}
      <TintedWithShading src={mouthSrc} tint={safe.mouthColor} zIndex={4} />

      {/* EYES: whites plain + iris tinted */}
      <LayerPlain src={eyesWhite} zIndex={5} />
      <MaskFill maskSrc={eyesIris} color={safe.eyeColor} zIndex={6} />

      {/* HAIR: preserve shading */}
      <TintedWithShading src={hairSrc} tint={safe.hairColor} zIndex={7} />

      {/* ACCESSORY: preserve shading */}
      {accessorySrc && <TintedWithShading src={accessorySrc} tint={safe.accessoryColor} zIndex={8} />}
    </div>
  );
}
